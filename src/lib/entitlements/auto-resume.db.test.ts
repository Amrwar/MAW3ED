import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Paused memberships whose pause ran out are resumed, and only those
 * (final audit F-29). The query read `limit` paused rows in no order and
 * skipped the not-yet-due ones, so with many paused memberships the due
 * ones could be missed run after run.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/entitlements/auto-resume.db.test.ts
 *
 * Everything it creates is tagged entrs- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const DAY = 86_400_000;

describe.skipIf(!local)("auto-resume of paused memberships", () => {
  let db: PrismaClient;
  let ledger: typeof import("./ledger");
  const tag = `entrs-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  let businessId = "";

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
  });

  afterAll(async () => {
    if (!db) return;
    const where = { businessId: { in: ids.businesses } };
    await db.membershipPeriod.deleteMany({ where: { membership: where } });
    await db.customerMembership.deleteMany({ where });
    await db.membershipPlan.deleteMany({ where });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("resumes a pause that has run out, even behind not-yet-due ones, and leaves the rest paused", async () => {
    const now = new Date();
    const plan = await db.membershipPlan.create({ data: { businessId, nameAr: "اشتراك", priceCents: 100, includedVisits: 4 } });
    const make = (pausedAt: Date, pausedDays: number, i: number) =>
      db.customerMembership.create({
        data: {
          planId: plan.id, businessId, phoneE164: `+2010000009${String(i).padStart(2, "0")}`, customerName: "M", includedVisits: 4,
          periodDays: 30, priceCents: 100, status: "PAUSED", pausedAt, pausedDays, paidThrough: new Date(now.getTime() + 20 * DAY),
        },
      });
    // Older pauses that are not due yet (they have days left), read first by
    // pausedAt — then the due one: paused 10 days ago with 55 of 60 used.
    const notDue = [];
    for (let i = 0; i < 3; i++) notDue.push(await make(new Date(now.getTime() - (30 + i) * DAY), 0, i));
    const due = await make(new Date(now.getTime() - 10 * DAY), 55, 9);

    await ledger.expireEntitlements(now, 2);

    expect((await db.customerMembership.findUniqueOrThrow({ where: { id: due.id } })).status).toBe("ACTIVE");
    for (const m of notDue) expect((await db.customerMembership.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("PAUSED");
  });
});
