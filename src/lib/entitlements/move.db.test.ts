import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Rescheduling a booking that uses a package session or a membership
 * visit (final audit F-11), on a real Postgres. Before, the reschedule
 * routes moved the time without looking: a package could be used after
 * its expiry, and visits booked in one month and moved into the next
 * stayed counted against the first, so a member could stack two months
 * of visits into one.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/entitlements/move.db.test.ts
 *
 * Everything it creates is tagged entmv- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);

describe.skipIf(!local)("moveEntitlement on a real database", () => {
  let db: PrismaClient;
  let ledger: typeof import("./ledger");
  const tag = `entmv-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  const phone = "+201000000077";
  let businessId = "";
  let serviceId = "";
  let slot = 0;

  const nov = new Date("2027-11-10T08:00:00Z");
  const dec = new Date("2027-12-10T08:00:00Z");

  async function booking() {
    const h = String(8 + (slot++ % 10)).padStart(2, "0");
    return db.booking.create({
      data: {
        businessId, serviceId, customerName: "M", customerPhone: "01000000077",
        date: new Date("2027-11-10T00:00:00Z"), startTime: `${h}:00`, endTime: `${h}:30`,
        startsAt: new Date(`2027-11-10T${h}:00:00Z`), endsAt: new Date(`2027-11-10T${h}:30:00Z`),
        status: "CONFIRMED", totalPrice: 0, accessToken: `${tag}-${slot}-${Math.random()}`,
      },
    });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ledger = await import("./ledger");
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const b = await db.business.create({ data: { slug: tag, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id } });
    ids.businesses.push(b.id);
    businessId = b.id;
    serviceId = (await db.service.create({ data: { businessId, nameAr: "خدمة", duration: 30, price: 100 } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    const where = { businessId: { in: ids.businesses } };
    await db.entitlementUse.deleteMany({ where: { booking: where } });
    await db.booking.deleteMany({ where });
    await db.membershipPeriod.deleteMany({ where: { membership: where } });
    await db.customerMembership.deleteMany({ where });
    await db.membershipPlan.deleteMany({ where });
    await db.customerPackage.deleteMany({ where });
    await db.packagePlan.deleteMany({ where });
    await db.service.deleteMany({ where });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("moves a membership visit to the month it now falls in, and refuses once that month is full", async () => {
    const plan = await db.membershipPlan.create({ data: { businessId, nameAr: "اشتراك", priceCents: 100, includedVisits: 1 } });
    const m = await db.customerMembership.create({
      data: { planId: plan.id, businessId, phoneE164: phone, customerName: "M", includedVisits: 1, periodDays: 30, priceCents: 100, status: "ACTIVE", paidThrough: new Date("2028-01-01T00:00:00Z") },
    });
    const p1 = await db.membershipPeriod.create({ data: { membershipId: m.id, startsAt: new Date("2027-11-01T00:00:00Z"), endsAt: new Date("2027-12-01T00:00:00Z"), includedVisits: 1, used: 1 } });
    const p2 = await db.membershipPeriod.create({ data: { membershipId: m.id, startsAt: new Date("2027-12-01T00:00:00Z"), endsAt: new Date("2028-01-01T00:00:00Z"), includedVisits: 1, used: 0 } });
    const first = await booking();
    await db.entitlementUse.create({ data: { bookingId: first.id, membershipId: m.id, periodId: p1.id } });

    await db.$transaction((tx) => ledger.moveEntitlement(tx, first.id, dec));
    expect((await db.membershipPeriod.findUniqueOrThrow({ where: { id: p1.id } })).used).toBe(0);
    expect((await db.membershipPeriod.findUniqueOrThrow({ where: { id: p2.id } })).used).toBe(1);
    expect((await db.entitlementUse.findUniqueOrThrow({ where: { bookingId: first.id } })).periodId).toBe(p2.id);

    // A second November visit cannot be stacked into the full December.
    const second = await booking();
    await db.membershipPeriod.update({ where: { id: p1.id }, data: { used: 1 } });
    await db.entitlementUse.create({ data: { bookingId: second.id, membershipId: m.id, periodId: p1.id } });
    await expect(db.$transaction((tx) => ledger.moveEntitlement(tx, second.id, dec))).rejects.toBeInstanceOf(ledger.EntitlementGone);
    expect((await db.membershipPeriod.findUniqueOrThrow({ where: { id: p2.id } })).used).toBe(1);
  });

  it("refuses to move a package session past the package's expiry", async () => {
    const plan = await db.packagePlan.create({ data: { businessId, nameAr: "باقة", sessions: 5, priceCents: 100, validityDays: 30 } });
    const pkg = await db.customerPackage.create({
      data: { planId: plan.id, businessId, phoneE164: phone, customerName: "M", sessionsTotal: 5, sessionsUsed: 1, priceCents: 100, status: "ACTIVE", expiresAt: new Date("2027-11-30T00:00:00Z") },
    });
    const b = await booking();
    await db.entitlementUse.create({ data: { bookingId: b.id, packageId: pkg.id } });
    await expect(db.$transaction((tx) => ledger.moveEntitlement(tx, b.id, dec))).rejects.toBeInstanceOf(ledger.EntitlementGone);
    await db.$transaction((tx) => ledger.moveEntitlement(tx, b.id, nov));
  });

  it("refuses to move a session of a package that was cancelled or refunded", async () => {
    const plan = await db.packagePlan.create({ data: { businessId, nameAr: "باقة ملغية", sessions: 5, priceCents: 100, validityDays: 30 } });
    const pkg = await db.customerPackage.create({
      data: { planId: plan.id, businessId, phoneE164: phone, customerName: "M", sessionsTotal: 5, sessionsUsed: 1, priceCents: 100, status: "CANCELLED", expiresAt: null },
    });
    const b = await booking();
    await db.entitlementUse.create({ data: { bookingId: b.id, packageId: pkg.id } });
    await expect(db.$transaction((tx) => ledger.moveEntitlement(tx, b.id, nov))).rejects.toBeInstanceOf(ledger.EntitlementGone);
  });
});
