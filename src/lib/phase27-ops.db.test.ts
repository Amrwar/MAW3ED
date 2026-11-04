import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Phase 27 operations against a real Postgres: the slot waitlist,
 * recurring series, membership expiry, automation consent and retries,
 * organization promotions, and table capacity. Companion to
 * phase27.db.test.ts (the ledgers).
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/phase27-ops.db.test.ts
 *
 * Everything it creates is tagged p27ops- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("Phase 27 operations on a real database", () => {
  let db: PrismaClient;
  let createBooking: typeof import("./bookings/create").createBooking;
  let moveBooking: typeof import("./bookings/state").moveBooking;
  let W: typeof import("./bookings/slot-waitlist");
  let S: typeof import("./bookings/series");
  let E: typeof import("./entitlements/ledger");
  let A: typeof import("./automations/send");
  let O: typeof import("./organizations/loyalty");
  const tag = `p27ops-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], orgs: [] as string[] };
  let seq = 0;
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const phone = () => `0111${String(Date.now() % 1e4).padStart(4, "0")}${String(++seq).padStart(3, "0")}`;

  async function makeBusiness(extra: Record<string, unknown> = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}-${ids.users.length}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: {
        slug: `${tag}-${ids.businesses.length}`, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id,
        minNoticeMinutes: 0, bufferMinutes: 0, isPublished: true, waitlistEnabled: true, waitlistOfferMinutes: 30,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "12:00" })) },
        ...extra,
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "كشف", duration: 60, price: 300 } });
    return { business, service, owner };
  }

  const book = (f: Awaited<ReturnType<typeof makeBusiness>>, date: string, startTime: string, extra: Partial<Parameters<typeof createBooking>[0]> = {}) =>
    createBooking({
      businessId: f.business.id, serviceId: f.service.id, customerId: null, customerName: "زبون", customerPhone: phone(),
      date, startTime, status: "CONFIRMED", totalPrice: 300, currency: "EGP", depositAmount: null, ...extra,
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ createBooking } = await import("./bookings/create"));
    ({ moveBooking } = await import("./bookings/state"));
    W = await import("./bookings/slot-waitlist");
    S = await import("./bookings/series");
    E = await import("./entitlements/ledger");
    A = await import("./automations/send");
    O = await import("./organizations/loyalty");
  });

  afterAll(async () => {
    if (!db) return;
    await db.notificationDelivery.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.notification.deleteMany({ where: { userId: { in: ids.users } } });
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.customerMembership.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.organization.deleteMany({ where: { id: { in: ids.orgs } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  // ─── Slot waitlist ─────────────────────────────────────────────────────────

  it("refuses a second live entry for the same number and day", async () => {
    const f = await makeBusiness();
    const p = phone();
    const entry = { businessId: f.business.id, serviceId: f.service.id, date: day(2), fromTime: "10:00", toTime: "12:00", customerName: "أ", customerPhone: p };
    const [a, b] = await Promise.all([W.joinWaitlist(entry), W.joinWaitlist(entry)]);
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1);
    const lost = [a, b].find((r) => !r.ok);
    expect(lost).toEqual({ ok: false, why: "already-waiting" });
    expect(await W.joinWaitlist({ ...entry, fromTime: "12:00", toTime: "11:00" })).toEqual({ ok: false, why: "bad-window" });
  });

  it("offers a freed time to the oldest fitting entry, once, and lets only one accept", async () => {
    const f = await makeBusiness();
    const date = day(3);
    const b1 = await book(f, date, "10:00");
    const b2 = await book(f, date, "11:00");
    expect(b1.ok && b2.ok).toBe(true);
    if (!b1.ok || !b2.ok) return;
    const first = await W.joinWaitlist({ businessId: f.business.id, serviceId: f.service.id, date, fromTime: "10:00", toTime: "12:00", customerName: "الأول", customerPhone: phone() });
    const second = await W.joinWaitlist({ businessId: f.business.id, serviceId: f.service.id, date, fromTime: "10:00", toTime: "12:00", customerName: "التاني", customerPhone: phone() });
    if (!first.ok || !second.ok) throw new Error("join");
    // Full day: nothing to offer.
    expect(await W.offerFreedTimes(f.business.id, date)).toBe(0);

    await moveBooking({ bookingId: b1.booking.id, from: "CONFIRMED", to: "CANCELLED", by: "customer" });
    // Two passes at once offer the one freed time once.
    const [x, y] = await Promise.all([W.offerFreedTimes(f.business.id, date), W.offerFreedTimes(f.business.id, date)]);
    expect(x + y).toBe(1);
    const offered = await db.slotWaitlistEntry.findMany({ where: { businessId: f.business.id, status: "OFFERED" } });
    expect(offered.map((o) => o.id)).toEqual([first.id]); // the oldest
    const o = offered[0];

    // A wrong token, then two taps at once: one booking.
    expect(await W.acceptOffer(first.manageToken, "x".repeat(20))).toEqual({ ok: false, why: "expired" });
    const [r1, r2] = await Promise.all([W.acceptOffer(first.manageToken, o.offerToken!), W.acceptOffer(first.manageToken, o.offerToken!)]);
    expect(r1.ok || r2.ok).toBe(true);
    expect(await db.booking.count({ where: { businessId: f.business.id, startTime: "10:00", status: { in: ["PENDING", "CONFIRMED"] } } })).toBe(1);
    expect((await db.slotWaitlistEntry.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("BOOKED");
    // The second entry still waits.
    expect((await db.slotWaitlistEntry.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("WAITING");
  });

  it("passes a lapsed offer on and ends an entry after three offers", async () => {
    const f = await makeBusiness();
    const date = day(4);
    const j = await W.joinWaitlist({ businessId: f.business.id, serviceId: f.service.id, date, fromTime: "10:00", toTime: "12:00", customerName: "أ", customerPhone: phone() });
    if (!j.ok) throw new Error("join");
    let now = new Date();
    expect(await W.offerFreedTimes(f.business.id, date, now)).toBe(1); // the day is free
    // Each sweep lapses the running offer and makes the next one.
    for (let i = 1; i <= 3; i++) {
      now = new Date(now.getTime() + 31 * 60_000);
      await W.sweepWaitlist(now);
    }
    const e = await db.slotWaitlistEntry.findUniqueOrThrow({ where: { id: j.id } });
    expect(e.offers).toBe(3);
    expect(e.status).toBe("EXPIRED");
    expect(await W.offerFreedTimes(f.business.id, date, now)).toBe(0);
  });

  // ─── Series ────────────────────────────────────────────────────────────────

  it("makes a bounded series, skips a taken week, and a retry adds nothing twice", async () => {
    const f = await makeBusiness();
    const start = day(1);
    const taken = await book(f, S.seriesDates(start, 1, 3)[1], "10:00");
    expect(taken.ok).toBe(true);
    const input = {
      businessId: f.business.id, serviceId: f.service.id, customerId: null, customerName: "متكرر", customerPhone: phone(),
      startDate: start, startTime: "10:00", intervalWeeks: 1, occurrences: 3, createdById: f.owner.id,
    };
    const r = await S.createSeries(input);
    if ("error" in r) throw new Error(r.error);
    expect(r.made.map((m) => m.index)).toEqual([0, 2]);
    expect(r.skipped).toEqual([{ index: 1, date: S.seriesDates(start, 1, 3)[1], why: "slot-unavailable" }]);
    expect(await S.createSeries({ ...input, occurrences: 13 })).toEqual({ error: "bounds" });
    // The database refuses an unbounded series however it is written.
    await expect(db.bookingSeries.create({ data: { ...seriesRow(f), occurrences: 50 } })).rejects.toThrow();

    const ended = await S.cancelSeries(f.business.id, r.seriesId, f.owner.id);
    expect(ended?.cancelled).toBe(2);
  });

  function seriesRow(f: Awaited<ReturnType<typeof makeBusiness>>) {
    return {
      businessId: f.business.id, customerName: "x", customerPhone: "0100", serviceId: f.service.id,
      intervalWeeks: 1, occurrences: 2, startDate: new Date(), startTime: "10:00",
    };
  }

  // ─── Memberships over time ─────────────────────────────────────────────────

  it("expires a lapsed membership, and ends one set to cancel at period end", async () => {
    const f = await makeBusiness();
    const plan = await db.membershipPlan.create({ data: { businessId: f.business.id, nameAr: "شهري", priceCents: 10000, periodDays: 30, includedVisits: 2 } });
    const a = await E.sellMembership({ businessId: f.business.id, planId: plan.id, phoneE164: "201110000001", customerName: "أ", method: "CASH", recordedById: f.owner.id });
    const b = await E.sellMembership({ businessId: f.business.id, planId: plan.id, phoneE164: "201110000002", customerName: "ب", method: "CASH", recordedById: f.owner.id });
    if (!a.ok || !b.ok) throw new Error("sale");
    expect(await E.cancelMembership(f.business.id, b.value.id, "period-end")).toEqual({ ok: true });
    await E.expireEntitlements(new Date(Date.now() + 31 * 86_400_000));
    expect((await db.customerMembership.findUniqueOrThrow({ where: { id: a.value.id } })).status).toBe("EXPIRED");
    expect((await db.customerMembership.findUniqueOrThrow({ where: { id: b.value.id } })).status).toBe("CANCELLED");
    // A lapsed one can be renewed: a fresh period from now.
    expect(await E.renewMembership({ businessId: f.business.id, membershipId: a.value.id, method: "CASH", recordedById: f.owner.id })).toEqual({ ok: true });
  });

  it("deletes a business that sold packages and memberships (the plan keys never block the cascade)", async () => {
    const f = await makeBusiness();
    const pp = await db.packagePlan.create({ data: { businessId: f.business.id, nameAr: "باقة", sessions: 3, priceCents: 1000, validityDays: 30 } });
    const mp = await db.membershipPlan.create({ data: { businessId: f.business.id, nameAr: "شهري", priceCents: 1000, periodDays: 30, includedVisits: 1 } });
    await E.sellPackage({ businessId: f.business.id, planId: pp.id, phoneE164: "201110000009", customerName: "أ", method: "CASH", recordedById: f.owner.id });
    await E.sellMembership({ businessId: f.business.id, planId: mp.id, phoneE164: "201110000009", customerName: "أ", method: "CASH", recordedById: f.owner.id });
    // A plan with sales cannot be deleted on its own…
    await expect(db.packagePlan.delete({ where: { id: pp.id } })).rejects.toThrow();
    // …but the business, with everything it sold, can.
    await db.business.delete({ where: { id: f.business.id } });
    expect(await db.customerPackage.count({ where: { businessId: f.business.id } })).toBe(0);
  });

  // ─── Automations ───────────────────────────────────────────────────────────

  it("sends marketing only with consent, within the weekly cap, and stops retrying after the last attempt", async () => {
    const f = await makeBusiness();
    const p = `2011${String(Date.now() % 1e7).padStart(7, "0")}`.slice(0, 12);
    const user = await db.user.create({ data: { email: `${tag}-c@example.test`, phone: p, phoneVerifiedAt: new Date() } });
    ids.users.push(user.id);
    const msg = (key: string, marketing = true) => ({ key, businessId: f.business.id, phoneE164: p, title: "t", body: "b", href: "/", marketing });

    expect((await A.sendAutoMessage(msg("m1")))[0]).toMatchObject({ status: "SKIPPED", reason: "no-consent" });
    await db.user.update({ where: { id: user.id }, data: { marketingConsentAt: new Date() } });
    const sent1 = await A.sendAutoMessage(msg("m1"));
    expect(sent1.find((o) => o.channel === "IN_APP")?.status).toBe("SENT");
    // The same message again: nothing new.
    expect((await A.sendAutoMessage(msg("m1"))).find((o) => o.channel === "IN_APP")?.status).toBe("DUPLICATE");
    await A.sendAutoMessage(msg("m2"));
    expect((await A.sendAutoMessage(msg("m3")))[0]).toMatchObject({ status: "SKIPPED", reason: "marketing-cap" });
    // Transactional messages are not capped.
    expect((await A.sendAutoMessage(msg("t1", false))).find((o) => o.channel === "IN_APP")?.status).toBe("SENT");
    expect(await db.notification.count({ where: { userId: user.id } })).toBe(3);

    // A row that failed on its last allowed attempt is closed, not retried.
    await db.notificationDelivery.create({
      data: {
        dedupeKey: `auto:tx:${tag}-dead:EMAIL`, kind: "GENERAL", channel: "EMAIL", status: "FAILED", recipient: "x@example.test",
        businessId: f.business.id, attempts: 5, nextAttemptAt: new Date(Date.now() - 1000),
        event: { type: "automation", ...msg(`${tag}-dead`, false) },
      },
    });
    await A.redriveAutomations();
    const dead = await db.notificationDelivery.findUniqueOrThrow({ where: { dedupeKey: `auto:tx:${tag}-dead:EMAIL` } });
    expect(dead.status).toBe("DEAD");
    expect(dead.attempts).toBe(5);
  });

  // ─── Organizations ─────────────────────────────────────────────────────────

  it("puts an organization's promotion only on brands it owns, switched off", async () => {
    const owned = await makeBusiness();
    const hosted = await makeBusiness();
    const org = await db.organization.create({ data: { slug: `${tag}-org`, nameAr: "مجموعة", createdById: owned.owner.id } });
    ids.orgs.push(org.id);
    await db.organizationBusiness.create({ data: { organizationId: org.id, businessId: owned.business.id, relation: "OWNED", status: "APPROVED", initiatedById: owned.owner.id } });
    await db.organizationBusiness.create({ data: { organizationId: org.id, businessId: hosted.business.id, relation: "HOSTED", status: "APPROVED", initiatedById: owned.owner.id } });
    const promo = await db.organizationPromotion.create({ data: { organizationId: org.id, nameAr: "عرض", kind: "PERCENT", value: 10 } });
    expect(await O.distributePromotion(org.id, promo.id)).toBe(1);
    expect(await O.distributePromotion(org.id, promo.id)).toBe(0); // idempotent
    const offers = await db.discount.findMany({ where: { organizationPromotionId: promo.id } });
    expect(offers.map((o) => [o.businessId, o.isActive])).toEqual([[owned.business.id, false]]);
  });

  // ─── Tables ────────────────────────────────────────────────────────────────

  it("never seats two parties at one table, nor a party bigger than any table", async () => {
    const f = await makeBusiness();
    const table = await db.resource.create({ data: { businessId: f.business.id, kind: "TABLE", name: "T1", capacity: 4 } });
    const date = day(5);
    const [a, b] = await Promise.all([
      book(f, date, "10:00", { resourceId: table.id, partySize: 2 }),
      book(f, date, "10:00", { resourceId: table.id, partySize: 2 }),
    ]);
    expect([a.ok, b.ok].filter(Boolean).length).toBe(1);
    const big = await book(f, date, "11:00", { partySize: 9 });
    expect(big).toEqual({ ok: false, failure: { kind: "party-too-large" } });
  });
});
