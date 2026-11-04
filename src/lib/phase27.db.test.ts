import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Phase 27 ledgers against a real Postgres: loyalty points, packages and
 * memberships, with the booking engine and its constraints underneath.
 * What is proved here is what only a database can show — two spends
 * racing, a replayed completion, a cancellation released twice.
 *
 * Needs a LOCAL database with every file in prisma/migrations applied
 * (phase27_enums.sql, then phase27_operations.sql); skipped otherwise:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/phase27.db.test.ts
 *
 * Everything it creates is tagged p27test- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("Phase 27 ledgers on a real database", () => {
  let db: PrismaClient;
  let createBooking: typeof import("./bookings/create").createBooking;
  let moveBooking: typeof import("./bookings/state").moveBooking;
  let L: typeof import("./loyalty/ledger");
  let E: typeof import("./entitlements/ledger");
  const tag = `p27test-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  let phoneSeq = 0;

  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

  async function makeBusiness(opts: { ownerPhone?: string } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({
      data: { email: `${tag}-${ids.users.length}@example.test`, name: tag, phone: opts.ownerPhone ?? null },
    });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: {
        slug: `${tag}-${ids.businesses.length}`,
        nameAr: tag,
        ownerId: owner.id,
        cityId: city.id,
        categoryId: category.id,
        minNoticeMinutes: 0,
        bufferMinutes: 0,
        availability: {
          create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "08:00", closeTime: "20:00" })),
        },
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "قص", duration: 30, price: 200 } });
    const other = await db.service.create({ data: { businessId: business.id, nameAr: "صبغة", duration: 30, price: 300 } });
    return { business, service, other, owner };
  }

  /** A fresh customer number: "010" + 8 digits; E.164 "2010…". */
  function newPhone() {
    phoneSeq++;
    const local = `010${String(Date.now() % 1e5).padStart(5, "0")}${String(phoneSeq).padStart(3, "0")}`;
    return { local, e164: `2${local.slice(0)}`.replace(/^20/, "20") };
  }

  function book(
    f: Awaited<ReturnType<typeof makeBusiness>>,
    phone: string,
    date: string,
    startTime: string,
    extra: Partial<Parameters<typeof createBooking>[0]> = {},
  ) {
    return createBooking({
      businessId: f.business.id,
      serviceId: f.service.id,
      customerId: null,
      customerName: "زبون",
      customerPhone: phone,
      date,
      startTime,
      status: "CONFIRMED",
      totalPrice: 200,
      currency: "EGP",
      depositAmount: null,
      ...extra,
    });
  }

  async function e164Of(bookingId: string) {
    const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { customerPhoneE164: true } });
    return b.customerPhoneE164!;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ createBooking } = await import("./bookings/create"));
    ({ moveBooking } = await import("./bookings/state"));
    L = await import("./loyalty/ledger");
    E = await import("./entitlements/ledger");
  });

  afterAll(async () => {
    if (!db) return;
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.loyaltyProgram.deleteMany({ where: { OR: [{ businessId: { in: ids.businesses } }, { organizationId: { in: ids.orgs } }] } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.customerPackage.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.customerMembership.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  // ─── Loyalty ───────────────────────────────────────────────────────────────

  it("earns once per completed visit, never for the owner's own number, and caps a day", async () => {
    const f = await makeBusiness({ ownerPhone: "201099999999" });
    await db.loyaltyProgram.create({ data: { businessId: f.business.id, nameAr: "نقاط", pointsPerVisit: 10, pointsPer100Egp: 5, dailyEarnCap: 2 } });
    const { local } = newPhone();
    const results: string[] = [];
    for (const t of ["09:00", "10:00", "11:00"]) {
      const r = await book(f, local, day(1), t);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      results.push(r.booking.id);
    }
    // Completing twice in parallel: one move wins, one earn entry.
    const [a, b] = await Promise.all([
      moveBooking({ bookingId: results[0], from: "CONFIRMED", to: "COMPLETED", by: "business" }),
      moveBooking({ bookingId: results[0], from: "CONFIRMED", to: "COMPLETED", by: "business" }),
    ]);
    expect([a.moved, b.moved].filter(Boolean).length).toBe(1);
    await moveBooking({ bookingId: results[1], from: "CONFIRMED", to: "COMPLETED", by: "business" });
    await moveBooking({ bookingId: results[2], from: "CONFIRMED", to: "COMPLETED", by: "business" });

    const phone = await e164Of(results[0]);
    const account = await db.loyaltyAccount.findFirstOrThrow({ where: { phoneE164: phone } });
    // 10 per visit + 5 per 100 EGP of 200 = 20; the third visit is past the daily cap.
    expect(account.balance).toBe(40);
    expect(await db.loyaltyEntry.count({ where: { accountId: account.id, kind: "EARN" } })).toBe(2);

    // A replayed earn for the same booking adds nothing.
    await db.$transaction((tx) => L.earnForBooking(tx, results[0]));
    expect((await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBe(40);

    // The owner booking themselves earns nothing.
    const self = await book(f, "01099999999", day(1), "12:00");
    expect(self.ok).toBe(true);
    if (!self.ok) return;
    await moveBooking({ bookingId: self.booking.id, from: "CONFIRMED", to: "COMPLETED", by: "business" });
    expect(await db.loyaltyAccount.count({ where: { phoneE164: "201099999999" } })).toBe(0);
  });

  it("lets only one of two racing bookings spend the same points, and gives them back once on cancel", async () => {
    const f = await makeBusiness();
    const program = await db.loyaltyProgram.create({ data: { businessId: f.business.id, nameAr: "نقاط", redeemPoints: 100, redeemValueCents: 5000, maxRedeemPercent: 50 } });
    const { local } = newPhone();
    const probe = await book(f, local, day(2), "08:00");
    expect(probe.ok).toBe(true);
    if (!probe.ok) return;
    const phone = await e164Of(probe.booking.id);
    await L.adjustPoints({ programId: program.id, phoneE164: phone, points: 100, note: "seed", actorUserId: f.owner.id, key: `${tag}-seed` });

    const spend = { programId: program.id, phoneE164: phone, points: 100, amountCents: 5000 };
    const results = await Promise.all([
      book(f, local, day(2), "09:00", { loyalty: spend, totalPrice: 150 }),
      book(f, local, day(2), "10:00", { loyalty: spend, totalPrice: 150 }),
      book(f, local, day(2), "11:00", { loyalty: spend, totalPrice: 150 }),
    ]);
    const made = results.filter((r) => r.ok);
    expect(made.length).toBe(1);
    expect(results.filter((r) => !r.ok && r.failure.kind === "loyalty-insufficient").length).toBe(2);
    const account = await db.loyaltyAccount.findFirstOrThrow({ where: { programId: program.id, phoneE164: phone } });
    expect(account.balance).toBe(0);
    // The losers left no booking behind.
    expect(await db.booking.count({ where: { businessId: f.business.id, loyaltyCents: { gt: 0 } } })).toBe(1);

    const won = made[0].ok ? made[0].booking.id : "";
    const c1 = await moveBooking({ bookingId: won, from: "CONFIRMED", to: "CANCELLED", by: "customer" });
    expect(c1.moved).toBe(true);
    // A second release (the reaper, say) returns nothing more.
    await db.$transaction((tx) => L.reverseRedemption(tx, won));
    expect((await db.loyaltyAccount.findUniqueOrThrow({ where: { id: account.id } })).balance).toBe(100);
  });

  it("takes points back when a released booking is revived by a late payment, and gives them back again on a second release", async () => {
    const f = await makeBusiness();
    const program = await db.loyaltyProgram.create({ data: { businessId: f.business.id, nameAr: "نقاط" } });
    const { local } = newPhone();
    const probe = await book(f, local, day(7), "08:00");
    if (!probe.ok) throw new Error("probe");
    const phone = await e164Of(probe.booking.id);
    await L.adjustPoints({ programId: program.id, phoneE164: phone, points: 100, note: "seed", actorUserId: f.owner.id, key: `${tag}-rv` });
    const r = await book(f, local, day(7), "09:00", { status: "PENDING_PAYMENT", depositAmount: 50, loyalty: { programId: program.id, phoneE164: phone, points: 100, amountCents: 5000 }, totalPrice: 150 });
    if (!r.ok) throw new Error("book");
    const bal = async () => (await db.loyaltyAccount.findFirstOrThrow({ where: { programId: program.id, phoneE164: phone } })).balance;
    expect(await bal()).toBe(0);
    await moveBooking({ bookingId: r.booking.id, from: "PENDING_PAYMENT", to: "FAILED_PAYMENT", by: "system" });
    expect(await bal()).toBe(100);
    // The webhook revives it and retakes, once.
    await db.$transaction(async (tx) => {
      await tx.booking.update({ where: { id: r.booking.id }, data: { status: "CONFIRMED" } });
      await L.retakeRedemption(tx, r.booking.id);
    });
    await db.$transaction((tx) => L.retakeRedemption(tx, r.booking.id));
    expect(await bal()).toBe(0);
    await moveBooking({ bookingId: r.booking.id, from: "CONFIRMED", to: "CANCELLED", by: "customer" });
    await db.$transaction((tx) => L.reverseRedemption(tx, r.booking.id));
    expect(await bal()).toBe(100);
  });

  it("reverses earned points on refund, once per refund, and never below zero", async () => {
    const f = await makeBusiness();
    const program = await db.loyaltyProgram.create({ data: { businessId: f.business.id, nameAr: "نقاط", pointsPerVisit: 100, redeemPoints: 50, redeemValueCents: 1000, maxRedeemPercent: 100 } });
    const { local } = newPhone();
    const r = await book(f, local, day(3), "09:00");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    await moveBooking({ bookingId: r.booking.id, from: "CONFIRMED", to: "COMPLETED", by: "business" });
    const phone = await e164Of(r.booking.id);

    const half = await db.$transaction((tx) => L.reverseEarn(tx, r.booking.id, 0.5, "refund-1"));
    expect(half).toEqual({ reversed: 50, shortfall: 0 });
    const again = await db.$transaction((tx) => L.reverseEarn(tx, r.booking.id, 0.5, "refund-1"));
    expect(again.reversed).toBe(0);

    // The customer spends the other 50, then the rest is refunded: nothing left to take.
    const spend = await book(f, local, day(3), "10:00", { loyalty: { programId: program.id, phoneE164: phone, points: 50, amountCents: 1000 }, totalPrice: 190 });
    expect(spend.ok ? "ok" : spend.failure).toBe("ok");
    const rest = await db.$transaction((tx) => L.reverseEarn(tx, r.booking.id, 1, "refund-2"));
    expect(rest).toEqual({ reversed: 0, shortfall: 50 });
    const account = await db.loyaltyAccount.findFirstOrThrow({ where: { programId: program.id, phoneE164: phone } });
    expect(account.balance).toBe(0);
  });

  it("expires lots once, and an expired lot cannot be spent", async () => {
    const f = await makeBusiness();
    const program = await db.loyaltyProgram.create({ data: { businessId: f.business.id, nameAr: "نقاط", expiryDays: 30 } });
    const { local } = newPhone();
    const probe = await book(f, local, day(4), "08:00");
    if (!probe.ok) throw new Error("probe");
    const phone = await e164Of(probe.booking.id);
    const past = new Date(Date.now() - 31 * 86_400_000);
    await L.adjustPoints({ programId: program.id, phoneE164: phone, points: 200, note: "old", actorUserId: f.owner.id, key: `${tag}-old` }, past);

    const spent = await book(f, local, day(4), "09:00", { loyalty: { programId: program.id, phoneE164: phone, points: 100, amountCents: 5000 }, totalPrice: 150 });
    expect(spent).toEqual({ ok: false, failure: { kind: "loyalty-insufficient" } });

    const first = await L.expireDueLots();
    expect(first.points).toBeGreaterThanOrEqual(200);
    const second = await L.expireDueLots();
    const account = await db.loyaltyAccount.findFirstOrThrow({ where: { programId: program.id, phoneE164: phone } });
    expect(account.balance).toBe(0);
    expect(await db.loyaltyEntry.count({ where: { accountId: account.id, kind: "EXPIRE" } })).toBe(1);
    expect(second.expired).toBe(0);
  });

  it("an organization's program reaches only brands it OWNS that accepted", async () => {
    const owned = await makeBusiness();
    const hosted = await makeBusiness();
    const org = await db.organization.create({ data: { slug: `${tag}-org`, nameAr: "مجموعة", createdById: owned.owner.id } });
    ids.orgs.push(org.id);
    await db.organizationBusiness.create({ data: { organizationId: org.id, businessId: owned.business.id, relation: "OWNED", status: "APPROVED", initiatedById: owned.owner.id } });
    await db.organizationBusiness.create({ data: { organizationId: org.id, businessId: hosted.business.id, relation: "HOSTED", status: "APPROVED", initiatedById: owned.owner.id } });
    const program = await db.loyaltyProgram.create({ data: { organizationId: org.id, nameAr: "نقاط المجموعة" } });
    await db.loyaltyParticipation.create({ data: { programId: program.id, businessId: owned.business.id, acceptedAt: new Date() } });
    await db.loyaltyParticipation.create({ data: { programId: program.id, businessId: hosted.business.id, acceptedAt: new Date() } });

    expect((await L.programForBusiness(owned.business.id))?.id).toBe(program.id);
    expect(await L.programForBusiness(hosted.business.id)).toBeNull();
    await db.loyaltyParticipation.updateMany({ where: { businessId: owned.business.id }, data: { leftAt: new Date() } });
    expect(await L.programForBusiness(owned.business.id)).toBeNull();
  });

  // ─── Packages ──────────────────────────────────────────────────────────────

  it("never lets two bookings take a package's last session, and gives it back on cancel", async () => {
    const f = await makeBusiness();
    const plan = await db.packagePlan.create({ data: { businessId: f.business.id, nameAr: "٢ قصات", serviceIds: [f.service.id], sessions: 2, priceCents: 30000, validityDays: 60 } });
    const { local } = newPhone();
    const probe = await book(f, local, day(5), "08:00");
    if (!probe.ok) throw new Error("probe");
    const phone = await e164Of(probe.booking.id);
    const sale = await E.sellPackage({ businessId: f.business.id, planId: plan.id, phoneE164: phone, customerName: "زبون", method: "CASH", recordedById: f.owner.id });
    expect(sale.ok).toBe(true);
    if (!sale.ok) return;
    const ent = { packageId: sale.value.id, phoneE164: phone };

    const results = await Promise.all(
      ["09:00", "10:00", "11:00", "12:00"].map((t) => book(f, local, day(5), t, { entitlement: ent, totalPrice: 0 })),
    );
    expect(results.filter((r) => r.ok).length).toBe(2);
    expect(results.filter((r) => !r.ok && r.failure.kind === "entitlement-gone").length).toBe(2);
    let pkg = await db.customerPackage.findUniqueOrThrow({ where: { id: sale.value.id } });
    expect(pkg).toMatchObject({ sessionsUsed: 2, status: "EXHAUSTED" });

    // Another service, or another number, is never covered.
    const wrong = await book(f, local, day(5), "13:00", { serviceId: f.other.id, entitlement: ent, totalPrice: 0 });
    expect(wrong.ok).toBe(false);

    const one = results.find((r) => r.ok)!;
    if (!one.ok) return;
    await moveBooking({ bookingId: one.booking.id, from: "CONFIRMED", to: "CANCELLED", by: "customer" });
    await db.$transaction((tx) => E.releaseEntitlement(tx, one.booking.id)); // a second release is a no-op
    pkg = await db.customerPackage.findUniqueOrThrow({ where: { id: sale.value.id } });
    expect(pkg).toMatchObject({ sessionsUsed: 1, status: "ACTIVE" });

    // A refund is refused while a booking still holds a session.
    const refused = await E.refundAtDesk({ businessId: f.business.id, target: { packageId: sale.value.id }, amountCents: 15000, reason: "t", actorId: f.owner.id, actorName: "o" });
    expect(refused).toEqual({ ok: false, why: "live-bookings" });
  });

  it("will not use a package after it expires", async () => {
    const f = await makeBusiness();
    const plan = await db.packagePlan.create({ data: { businessId: f.business.id, nameAr: "باقة", sessions: 5, priceCents: 10000, validityDays: 7 } });
    const { local } = newPhone();
    const probe = await book(f, local, day(9), "08:00");
    if (!probe.ok) throw new Error("probe");
    const phone = await e164Of(probe.booking.id);
    const sale = await E.sellPackage({ businessId: f.business.id, planId: plan.id, phoneE164: phone, customerName: "زبون", method: "CASH", recordedById: f.owner.id });
    if (!sale.ok) throw new Error("sale");
    // Valid seven days; an appointment nine days out is past it.
    const late = await book(f, local, day(9), "09:00", { entitlement: { packageId: sale.value.id, phoneE164: phone }, totalPrice: 0 });
    expect(late).toEqual({ ok: false, failure: { kind: "entitlement-gone" } });
    const r = await E.expireEntitlements(new Date(Date.now() + 8 * 86_400_000));
    expect(r.packages).toBeGreaterThanOrEqual(1);
    expect((await db.customerPackage.findUniqueOrThrow({ where: { id: sale.value.id } })).status).toBe("EXPIRED");
  });

  // ─── Memberships ───────────────────────────────────────────────────────────

  it("counts membership visits per paid period, blocks while paused, and renews without resetting", async () => {
    const f = await makeBusiness();
    const plan = await db.membershipPlan.create({ data: { businessId: f.business.id, nameAr: "شهري", priceCents: 50000, periodDays: 30, includedVisits: 1 } });
    const { local } = newPhone();
    const probe = await book(f, local, day(1), "19:00");
    if (!probe.ok) throw new Error("probe");
    const phone = await e164Of(probe.booking.id);
    const sale = await E.sellMembership({ businessId: f.business.id, planId: plan.id, phoneE164: phone, customerName: "زبون", method: "CARD", recordedById: f.owner.id });
    if (!sale.ok) throw new Error("sale");
    const ent = { membershipId: sale.value.id, phoneE164: phone };

    const [x, y] = await Promise.all([
      book(f, local, day(2), "15:00", { entitlement: ent, totalPrice: 0 }),
      book(f, local, day(3), "15:00", { entitlement: ent, totalPrice: 0 }),
    ]);
    expect([x.ok, y.ok].filter(Boolean).length).toBe(1);

    // Beyond the paid period: nothing to count against until renewed.
    const later = await book(f, local, day(35), "15:00", { entitlement: ent, totalPrice: 0 });
    expect(later.ok).toBe(false);
    expect(await E.renewMembership({ businessId: f.business.id, membershipId: sale.value.id, method: "CASH", recordedById: f.owner.id })).toEqual({ ok: true });
    // Paid one period ahead already: a third payment is refused.
    expect(await E.renewMembership({ businessId: f.business.id, membershipId: sale.value.id, method: "CASH", recordedById: f.owner.id })).toEqual({ ok: false, why: "paid-ahead" });
    const renewed = await book(f, local, day(35), "15:00", { entitlement: ent, totalPrice: 0 });
    expect(renewed.ok).toBe(true);
    // The current period was not reset by paying early.
    const again = await book(f, local, day(4), "15:00", { entitlement: ent, totalPrice: 0 });
    expect(again.ok).toBe(false);

    // Paused: nothing is taken.
    const pausedAt = new Date();
    expect(await E.pauseMembership(f.business.id, sale.value.id, pausedAt)).toEqual({ ok: true });
    const paused = await book(f, local, day(36), "16:00", { entitlement: ent, totalPrice: 0 });
    expect(paused.ok).toBe(false);
    const before = await db.customerMembership.findUniqueOrThrow({ where: { id: sale.value.id } });
    expect(await E.resumeMembership(f.business.id, sale.value.id, new Date(pausedAt.getTime() + 5 * 86_400_000))).toEqual({ ok: true });
    const after = await db.customerMembership.findUniqueOrThrow({ where: { id: sale.value.id } });
    expect(after.status).toBe("ACTIVE");
    expect(after.pausedDays).toBe(5);
    expect(after.paidThrough!.getTime() - before.paidThrough!.getTime()).toBe(5 * 86_400_000);
  });
});
