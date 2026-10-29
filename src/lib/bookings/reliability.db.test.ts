import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

// lib/business-access takes `err` and `requireSession` from here; the
// real module pulls in next-auth, which Vitest cannot resolve. Only
// bookingScope — a pure where-clause — is used below.
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400) => Response.json({ error: message }, { status }),
  requireSession: async () => {
    throw new Error("no session in this test");
  },
}));

/**
 * Phase 19: the booking engine under contention, on a real Postgres with
 * its exclusion constraints — the only place these guarantees can be
 * shown rather than argued.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/bookings/reliability.db.test.ts
 *
 * Everything it creates is tagged p19rel- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("booking reliability on a real database", () => {
  let db: PrismaClient;
  let createBooking: typeof import("./create").createBooking;
  let loadAvailability: typeof import("./schedule").loadAvailability;
  let moveBooking: typeof import("./state").moveBooking;
  let bookingScope: typeof import("@/lib/business-access").bookingScope;
  const tag = `p19rel-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  const date = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);

  type Fixture = Awaited<ReturnType<typeof makeBusiness>>;

  async function makeBusiness(opts: { staff?: string[]; tables?: number[]; bufferMinutes?: number } = {}) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}-${ids.users.length}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: {
        slug: `${tag}-${ids.businesses.length}`,
        nameAr: tag,
        ownerId: owner.id,
        cityId: city.id,
        categoryId: category.id,
        minNoticeMinutes: 0,
        bufferMinutes: opts.bufferMinutes ?? 0,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "17:00" })) },
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 60, price: 100 } });
    const members = [];
    for (const name of opts.staff ?? []) {
      members.push(await db.staffMember.create({ data: { businessId: business.id, nameAr: name, workingDays: [] } }));
    }
    const tables = [];
    for (const [i, capacity] of (opts.tables ?? []).entries()) {
      tables.push(await db.resource.create({ data: { businessId: business.id, name: `T${i + 1}`, kind: "TABLE", capacity, sortOrder: i } }));
    }
    const customer = await db.customer.create({ data: { businessId: business.id, name: "زبون", phone: "01000000019" } });
    return { business, service, members, tables, customer, owner };
  }

  function book(
    f: Fixture,
    startTime: string,
    extra: Partial<Parameters<typeof createBooking>[0]> = {},
  ) {
    return createBooking({
      businessId: f.business.id,
      serviceId: f.service.id,
      customerId: f.customer.id,
      customerName: "زبون",
      customerPhone: "01000000019",
      date,
      startTime,
      status: "CONFIRMED",
      totalPrice: 100,
      currency: "EGP",
      depositAmount: null,
      ...extra,
    });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ createBooking } = await import("./create"));
    ({ loadAvailability } = await import("./schedule"));
    ({ moveBooking } = await import("./state"));
    ({ bookingScope } = await import("@/lib/business-access"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.auditLog.deleteMany({ where: { resourceType: "Booking", resourceId: { in: (await db.booking.findMany({ where: { businessId: { in: ids.businesses } }, select: { id: true } })).map((b) => b.id) } } });
    // Payments first: a booking payment must name its booking (Payment_target_chk).
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  /* ── Concurrency ─────────────────────────────────────────── */

  it("gives one table to one of fifty simultaneous requests and refuses the other forty-nine", async () => {
    const f = await makeBusiness({ tables: [4] });
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        book(f, "10:00", { resourceId: f.tables[0].id, partySize: 2, customerPhone: `010000${String(i).padStart(5, "0")}` }),
      ),
    );
    const won = results.filter((r) => r.ok);
    const lost = results.filter((r) => !r.ok);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(49);
    expect(new Set(lost.map((r) => (r.ok ? "" : r.failure.kind)))).toEqual(new Set(["slot-taken"]));
    expect(await db.booking.count({ where: { businessId: f.business.id, startTime: "10:00" } })).toBe(1);
  }, 60_000);

  it("fills every table once under contention, then nothing more", async () => {
    const f = await makeBusiness({ tables: [2, 4, 4, 8] });
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => book(f, "11:00", { partySize: 2, customerPhone: `0101${String(i).padStart(7, "0")}` })),
    );
    const won = results.filter((r) => r.ok);
    expect(won).toHaveLength(4);
    const held = await db.booking.findMany({ where: { businessId: f.business.id, startTime: "11:00" }, select: { resourceId: true } });
    expect(new Set(held.map((b) => b.resourceId)).size).toBe(4);
    const after = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date, partySize: 2 });
    expect(after.slots).not.toContain("11:00");
  }, 60_000);

  it("two customers competing for the final slot: one gets it, the other is told it went", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const [a, b] = await Promise.all([book(f, "12:00"), book(f, "12:00", { customerPhone: "01000000020" })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const loser = a.ok ? b : a;
    expect(loser.ok === false && loser.failure.kind).toBe("slot-taken");
  });

  /* ── Idempotency ─────────────────────────────────────────── */

  it("returns one booking for twenty simultaneous requests carrying the same idempotency key", async () => {
    const f = await makeBusiness({ tables: [4] });
    const key = `${tag}-same-key`;
    const results = await Promise.all(Array.from({ length: 20 }, () => book(f, "13:00", { resourceId: f.tables[0].id, idempotencyKey: key })));
    expect(results.every((r) => r.ok)).toBe(true);
    const bookingIds = new Set(results.map((r) => (r.ok ? r.booking.id : "")));
    expect(bookingIds.size).toBe(1);
    expect(results.filter((r) => r.ok && !r.reused)).toHaveLength(1);
    expect(await db.booking.count({ where: { idempotencyKey: key } })).toBe(1);
  }, 60_000);

  it("lets different idempotency keys compete for one resource: exactly one wins", async () => {
    const f = await makeBusiness({ tables: [4] });
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => book(f, "14:00", { resourceId: f.tables[0].id, idempotencyKey: `${tag}-k${i}`, customerPhone: `0102${String(i).padStart(7, "0")}` })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    // The losers' keys are not burned: retrying one later at a free time works.
    const retry = await book(f, "15:00", { resourceId: f.tables[0].id, idempotencyKey: `${tag}-k1`, customerPhone: "01020000001" });
    expect(retry.ok).toBe(true);
  }, 60_000);

  /* ── Tables, capacity and party size ─────────────────────── */

  it("refuses a party bigger than the table asked for, and seats 'any table' at the smallest that fits", async () => {
    const f = await makeBusiness({ tables: [2, 4, 8] });
    const tooMany = await book(f, "09:00", { resourceId: f.tables[0].id, partySize: 3 });
    expect(tooMany.ok === false && tooMany.failure.kind).toBe("party-too-large");

    const three = await book(f, "09:00", { partySize: 3 });
    expect(three.ok && three.booking.resourceId).toBe(f.tables[1].id);
    const two = await book(f, "09:00", { partySize: 2, customerPhone: "01000000021" });
    expect(two.ok && two.booking.resourceId).toBe(f.tables[0].id);
    const six = await book(f, "09:00", { partySize: 6, customerPhone: "01000000022" });
    expect(six.ok && six.booking.resourceId).toBe(f.tables[2].id);

    const nine = await book(f, "10:00", { partySize: 9 });
    expect(nine.ok === false && nine.failure.kind).toBe("party-too-large");
    const slots = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date, partySize: 9 });
    expect(slots.slots).toEqual([]);
    expect(slots.reason).toBe("party-too-large");
  });

  /* ── State transitions under a race ──────────────────────── */

  it("lets exactly one of a confirm and a cancel racing on the same booking apply", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const made = await book(f, "09:00", { status: "PENDING" });
    if (!made.ok) throw new Error("fixture");
    const id = made.booking.id;
    const [confirm, cancel] = await Promise.all([
      moveBooking({ bookingId: id, from: "PENDING", to: "CONFIRMED", by: "business" }),
      moveBooking({ bookingId: id, from: "PENDING", to: "CANCELLED", by: "customer" }),
    ]);
    expect([confirm.moved, cancel.moved].filter(Boolean)).toHaveLength(1);
    const after = await db.booking.findUniqueOrThrow({ where: { id } });
    expect(after.status).toBe(confirm.moved ? "CONFIRMED" : "CANCELLED");
  });

  it("refuses a move the table does not allow, and one decided from a stale status", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const made = await book(f, "10:00");
    if (!made.ok) throw new Error("fixture");
    expect(await moveBooking({ bookingId: made.booking.id, from: "CONFIRMED", to: "PENDING", by: "business" })).toEqual({ moved: false, why: "not-allowed" });
    expect(await moveBooking({ bookingId: made.booking.id, from: "PENDING", to: "CONFIRMED", by: "business" })).toEqual({ moved: false, why: "changed" });
    expect((await db.booking.findUniqueOrThrow({ where: { id: made.booking.id } })).status).toBe("CONFIRMED");
  });

  it("cancelling gives the time back, closes the payment page, hands the discount back and flags paid money", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const discount = await db.discount.create({
      data: { businessId: f.business.id, code: `${tag}-OFF`, nameAr: "خصم", kind: "PERCENT", value: 10, maxRedemptions: 1 },
    });
    const made = await book(f, "11:00", { status: "PENDING_PAYMENT", depositAmount: 20, discount: { id: discount.id, amountCents: 1000 }, totalPrice: 90 });
    if (!made.ok) throw new Error("fixture");
    const id = made.booking.id;
    expect((await db.discount.findUniqueOrThrow({ where: { id: discount.id } })).redemptionCount).toBe(1);

    // A payment page open, and some cash already taken at the counter.
    const open = await db.payment.create({ data: { kind: "BOOKING_DEPOSIT", businessId: f.business.id, bookingId: id, amountCents: 2000, status: "PENDING", providerOrderId: `${Date.now()}` } });
    await db.payment.create({ data: { kind: "BOOKING_BALANCE", businessId: f.business.id, bookingId: id, amountCents: 3000, status: "SUCCEEDED", provider: "MANUAL", method: "CASH", paidAt: new Date() } });

    const move = await moveBooking({ bookingId: id, from: "PENDING_PAYMENT", to: "CANCELLED", by: "business", actorUserId: f.owner.id });
    expect(move).toEqual({ moved: true, refundNeededCents: 3000 });
    expect((await db.payment.findUniqueOrThrow({ where: { id: open.id } })).status).toBe("ABANDONED");
    expect((await db.discount.findUniqueOrThrow({ where: { id: discount.id } })).redemptionCount).toBe(0);
    expect(await db.discountRedemption.count({ where: { bookingId: id } })).toBe(0);
    expect(await db.auditLog.count({ where: { action: "booking.released_with_money", resourceId: id } })).toBe(1);

    // The time is free again, and the offer can be used once more.
    const slots = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date });
    expect(slots.slots).toContain("11:00");
    const again = await book(f, "11:00", { discount: { id: discount.id, amountCents: 1000 }, totalPrice: 90, customerPhone: "01000000023" });
    expect(again.ok).toBe(true);
  });

  /* ── Absence, holidays, moving ───────────────────────────── */

  it("keeps an existing booking when its staff member goes on leave, and offers nothing new for them", async () => {
    const f = await makeBusiness({ staff: ["أ", "ب"] });
    const made = await book(f, "12:00", { staffMemberId: f.members[0].id });
    if (!made.ok) throw new Error("fixture");
    await db.timeBlock.create({
      data: { businessId: f.business.id, staffMemberId: f.members[0].id, kind: "VACATION", startsOn: new Date(`${date}T00:00:00Z`), endsOn: new Date(`${date}T00:00:00Z`) },
    });
    const forA = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date, staffMemberId: f.members[0].id });
    expect(forA.slots).toEqual([]);
    expect(forA.reason).toBe("vacation");
    // The booking stands; moving it to the same person that day is refused; "anyone" still has the other member.
    expect((await db.booking.findUniqueOrThrow({ where: { id: made.booking.id } })).status).toBe("CONFIRMED");
    const move = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date, staffMemberId: f.members[0].id, excludeBookingId: made.booking.id });
    expect(move.slots).toEqual([]);
    const anyone = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date });
    expect(anyone.slots).toContain("12:00");
    expect(anyone.assignments["12:00"]).toBe(f.members[1].id);
  });

  it("closes a holiday for everyone and reopens the next day", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const next = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    await db.timeBlock.create({ data: { businessId: f.business.id, kind: "HOLIDAY", startsOn: new Date(`${date}T00:00:00Z`), endsOn: new Date(`${date}T00:00:00Z`) } });
    const closed = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date });
    expect(closed.slots).toEqual([]);
    expect(closed.reason).toBe("holiday");
    const open = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date: next });
    expect(open.slots.length).toBeGreaterThan(0);
    const refused = await book(f, "10:00");
    expect(refused.ok === false && refused.failure.kind === "slot-unavailable" && refused.failure.reason).toBe("holiday");
  });

  it("does not offer a move into a time somebody else holds, and does offer the booking's own time", async () => {
    const f = await makeBusiness({ staff: ["أ"] });
    const mine = await book(f, "09:00");
    const theirs = await book(f, "10:00", { customerPhone: "01000000024" });
    if (!mine.ok || !theirs.ok) throw new Error("fixture");
    const options = await loadAvailability({ businessId: f.business.id, serviceId: f.service.id, date, staffMemberId: mine.booking.staffMemberId, excludeBookingId: mine.booking.id });
    expect(options.slots).toContain("09:00");
    expect(options.slots).not.toContain("10:00");
    expect(options.slots).toContain("11:00");
  });

  /* ── Tenant isolation ────────────────────────────────────── */

  it("does not let one business's scope reach another business's booking, nor a provider a colleague's", async () => {
    const a = await makeBusiness({ staff: ["أ", "ب"] });
    const b = await makeBusiness({ staff: ["ج"] });
    const mine = await book(a, "09:00", { staffMemberId: a.members[0].id });
    const theirs = await book(b, "09:00");
    if (!mine.ok || !theirs.ok) throw new Error("fixture");

    const owner = { role: "OWNER" as const, userId: a.owner.id, staffMemberId: null };
    const providerB = { role: "PROVIDER" as const, userId: "u-b", staffMemberId: a.members[1].id };
    const providerA = { role: "PROVIDER" as const, userId: "u-a", staffMemberId: a.members[0].id };

    expect(await db.booking.findFirst({ where: { id: theirs.booking.id, ...bookingScope(a.business, owner) } })).toBeNull();
    expect(await db.booking.findFirst({ where: { id: mine.booking.id, ...bookingScope(a.business, owner) } })).not.toBeNull();
    expect(await db.booking.findFirst({ where: { id: mine.booking.id, ...bookingScope(a.business, providerB) } })).toBeNull();
    expect(await db.booking.findFirst({ where: { id: mine.booking.id, ...bookingScope(a.business, providerA) } })).not.toBeNull();
  });
});
