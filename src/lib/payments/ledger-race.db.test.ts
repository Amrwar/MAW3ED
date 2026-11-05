import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

/**
 * Payment status transitions under concurrency (final audit F-13), on a
 * real Postgres. Each case holds the first transaction open (its callback
 * waits) while the second starts, which is the window a decline and a
 * success for the same order, or the reaper and a late webhook, share.
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/payments/ledger-race.db.test.ts
 *
 * Everything it creates is tagged ldrace- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe.skipIf(!local)("payment ledger races on a real database", () => {
  let db: PrismaClient;
  let ledger: typeof import("./ledger");
  let reap: typeof import("./reap");
  const tag = `ldrace-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[] };
  let seq = 0;

  async function pending(createdAt?: Date) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const n = seq++;
    const owner = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: { slug: `${tag}-${n}`, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id, plan: "FREE" },
    });
    ids.businesses.push(business.id);
    return db.payment.create({
      data: {
        kind: "SUBSCRIPTION", businessId: business.id, plan: "PRO", amountCents: 29900, currency: "EGP",
        provider: "PAYMOB", status: "PENDING", providerOrderId: `${tag}-o${n}`, periodMonths: 1,
        ...(createdAt ? { createdAt } : {}),
      },
    });
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ledger = await import("./ledger");
    reap = await import("./reap");
  });

  afterAll(async () => {
    if (!db) return;
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("a decline that overlaps a success never leaves the payment FAILED", async () => {
    const p = await pending();
    const settling = ledger.settlePayment({ paymentId: p.id, providerTransactionId: "txn-ok", onFirstSettle: () => wait(400) });
    await wait(100);
    const failing = ledger.failPayment({ paymentId: p.id, reason: "declined", providerTransactionId: "txn-bad" });
    const [s, f] = await Promise.all([settling, failing]);
    expect(s.changed).toBe(true);
    expect(f.changed).toBe(false);
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("SUCCEEDED");
  });

  it("two overlapping settlements change it once", async () => {
    const p = await pending();
    const first = ledger.settlePayment({ paymentId: p.id, providerTransactionId: "txn-1", onFirstSettle: () => wait(400) });
    await wait(100);
    const second = ledger.settlePayment({ paymentId: p.id, providerTransactionId: "txn-2" });
    const results = await Promise.all([first, second]);
    expect(results.filter((r) => r.changed)).toHaveLength(1);
  });

  it("the reaper does not abandon a payment whose settlement is committing", async () => {
    const p = await pending(new Date(Date.now() - 3 * 60 * 60 * 1000));
    const settling = ledger.settlePayment({ paymentId: p.id, providerTransactionId: "txn-late", onFirstSettle: () => wait(400) });
    await wait(100);
    await reap.reapAbandonedPayments();
    await settling;
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("SUCCEEDED");
  });
});
