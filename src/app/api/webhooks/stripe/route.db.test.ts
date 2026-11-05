import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { signStripePayload } from "@/lib/services/stripe";

/**
 * The Stripe webhook against a real Postgres: the ledger, the claim table
 * and the business's plan, with events signed exactly as Stripe signs
 * them. Only the sends are faked. No call reaches Stripe.
 *
 * Needs a LOCAL database with every file in prisma/migrations applied
 * (stripe_provider.sql included); skipped otherwise:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/app/api/webhooks/stripe/route.db.test.ts
 *
 * Everything it creates is tagged stwh- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const SECRET = "whsec_stripe-webhook-db-test";

vi.mock("@/lib/notifications", () => ({ notify: vi.fn(async () => []), notifyLater: vi.fn() }));

describe.skipIf(!local)("POST /api/webhooks/stripe on a real database", () => {
  let db: PrismaClient;
  let POST: typeof import("./route").POST;
  const tag = `stwh-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], events: [] as string[] };
  let seq = 0;

  async function deliver(type: string, object: Record<string, unknown>, opts: { secret?: string; id?: string } = {}) {
    const id = opts.id ?? `evt_${tag}_${seq++}`;
    ids.events.push(id);
    const raw = JSON.stringify({ id, type, data: { object } });
    const res = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": signStripePayload(raw, opts.secret ?? SECRET) },
        body: raw,
      }),
    );
    return { status: res.status, ...((await res.json()) as Record<string, unknown>) };
  }

  /** A business on FREE with a pending Stripe plan payment, as the upgrade route leaves it. */
  async function pendingPlan(plan: "PRO" | "PREMIUM" = "PRO", amountCents = 29900, months: 1 | 12 = 1) {
    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const n = seq++;
    const owner = await db.user.create({ data: { email: `${tag}-${n}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const sessionId = `cs_test_${tag}_${n}`;
    const business = await db.business.create({
      data: { slug: `${tag}-${n}`, nameAr: tag, ownerId: owner.id, cityId: city.id, categoryId: category.id, plan: "FREE", pendingPlan: plan, subscriptionPaymobOrderId: sessionId },
    });
    ids.businesses.push(business.id);
    const payment = await db.payment.create({
      data: { kind: "SUBSCRIPTION", businessId: business.id, plan, amountCents, currency: "EGP", provider: "STRIPE", status: "PENDING", providerOrderId: sessionId, periodMonths: months },
    });
    const session = (over: Record<string, unknown> = {}) => ({
      id: sessionId,
      object: "checkout.session",
      payment_status: "paid",
      amount_total: amountCents,
      currency: "egp",
      payment_intent: `pi_${tag}_${n}`,
      client_reference_id: payment.id,
      metadata: { paymentId: payment.id, businessId: business.id, kind: "SUBSCRIPTION" },
      ...over,
    });
    return { business, payment, session };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ POST } = await import("./route"));
  });

  afterAll(async () => {
    if (!db) return;
    await db.webhookEvent.deleteMany({ where: { provider: "STRIPE", eventId: { in: ids.events } } });
    await db.lifecycleEvent.deleteMany({ where: { userId: { in: ids.users } } });
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("refuses an event signed with another secret, and an unsigned one", async () => {
    const { session } = await pendingPlan();
    expect((await deliver("checkout.session.completed", session(), { secret: "whsec_wrong" })).status).toBe(400);
    const res = await POST(new Request("http://localhost/api/webhooks/stripe", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });

  it("a paid session activates the plan once, with a receipt; a redelivery changes nothing", async () => {
    const { business, payment, session } = await pendingPlan("PRO");
    const event = `evt_${tag}_paid`;
    const first = await deliver("checkout.session.completed", session(), { id: event });
    expect(first).toMatchObject({ status: 200, outcome: "subscription-settled" });
    const paid = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(paid.status).toBe("SUCCEEDED");
    expect(paid.receiptNumber).toMatch(/^MW-/);
    expect(paid.providerTransactionId).toBe(session().payment_intent);
    const b = await db.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(b).toMatchObject({ plan: "PRO", subscriptionStatus: "ACTIVE", pendingPlan: null, subscriptionPaymobOrderId: null });
    expect(b.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 27 * 86_400_000);
    expect(await deliver("checkout.session.completed", session(), { id: event })).toMatchObject({ outcome: "duplicate" });
    // Another event for the same session (async_payment_succeeded after completed) settles nothing twice.
    expect(await deliver("checkout.session.async_payment_succeeded", session())).toMatchObject({ outcome: "already-settled" });
  });

  it("a year bought is a year", async () => {
    const { business, session } = await pendingPlan("PREMIUM", 499000, 12);
    expect(await deliver("checkout.session.completed", session())).toMatchObject({ outcome: "subscription-settled" });
    const b = await db.business.findUniqueOrThrow({ where: { id: business.id } });
    expect(b.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 360 * 86_400_000);
  });

  it("a completed but unpaid session waits; the async result decides", async () => {
    const ok = await pendingPlan();
    expect(await deliver("checkout.session.completed", ok.session({ payment_status: "unpaid" }))).toMatchObject({ outcome: "awaiting-payment" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: ok.payment.id } })).status).toBe("PENDING");
    expect(await deliver("checkout.session.async_payment_succeeded", ok.session())).toMatchObject({ outcome: "subscription-settled" });

    const bad = await pendingPlan();
    await deliver("checkout.session.completed", bad.session({ payment_status: "unpaid" }));
    expect(await deliver("checkout.session.async_payment_failed", bad.session({ payment_status: "unpaid" }))).toMatchObject({ outcome: "failed" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: bad.payment.id } })).status).toBe("FAILED");
    expect(await db.business.findUniqueOrThrow({ where: { id: bad.business.id } })).toMatchObject({ plan: "FREE", pendingPlan: null });
  });

  it("an expired session releases the pending plan", async () => {
    const { business, payment, session } = await pendingPlan();
    expect(await deliver("checkout.session.expired", session({ payment_status: "unpaid" }))).toMatchObject({ outcome: "failed" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect(await db.business.findUniqueOrThrow({ where: { id: business.id } })).toMatchObject({ pendingPlan: null, plan: "FREE" });
  });

  it("a wrong amount or currency never activates a plan", async () => {
    const a = await pendingPlan();
    expect(await deliver("checkout.session.completed", a.session({ amount_total: 100 }))).toMatchObject({ outcome: "amount-mismatch" });
    expect(await db.business.findUniqueOrThrow({ where: { id: a.business.id } })).toMatchObject({ plan: "FREE" });
    const c = await pendingPlan();
    expect(await deliver("checkout.session.completed", c.session({ currency: "usd" }))).toMatchObject({ outcome: "amount-mismatch" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: c.payment.id } })).status).toBe("FAILED");
  });

  it("a session that is not the one the payment opened is ignored", async () => {
    const { business, payment, session } = await pendingPlan();
    expect(await deliver("checkout.session.completed", session({ id: "cs_test_someone_else" }))).toMatchObject({ outcome: "no-matching-payment" });
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PENDING");
    expect(await db.business.findUniqueOrThrow({ where: { id: business.id } })).toMatchObject({ plan: "FREE" });
  });

  it("a refund made in the Stripe Dashboard is recorded, never double counted", async () => {
    const { payment, session } = await pendingPlan();
    await deliver("checkout.session.completed", session());
    const charge = { id: `ch_${tag}`, payment_intent: session().payment_intent, amount: 29900, currency: "egp" };
    expect(await deliver("charge.refunded", { ...charge, amount_refunded: 10000 })).toMatchObject({ outcome: "refund-recorded" });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ refundedCents: 10000, status: "PARTIALLY_REFUNDED" });
    // The same figure again (another delivery) changes nothing.
    expect(await deliver("charge.refunded", { ...charge, amount_refunded: 10000 })).toMatchObject({ outcome: "refund-already-recorded" });
    expect(await deliver("charge.refunded", { ...charge, amount_refunded: 99999 })).toMatchObject({ outcome: "refund-recorded" });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ refundedCents: 29900, status: "REFUNDED" });
    // Each figure has its Refund rows, so reconciliation adds up (final audit F-15).
    const rows = await db.refund.findMany({ where: { paymentId: payment.id } });
    expect(rows.every((r) => r.status === "SUCCEEDED" && r.actorName === "Stripe")).toBe(true);
    expect(rows.reduce((sum, r) => sum + r.amountCents, 0)).toBe(29900);
    expect(rows).toHaveLength(2);
  });

  it("an admin refund left 'uncertain' is settled when Stripe reports the money returned", async () => {
    const { payment, session } = await pendingPlan();
    await deliver("checkout.session.completed", session());
    // What the refund route leaves after a timeout: the reservation kept, the row PENDING.
    await db.payment.update({ where: { id: payment.id }, data: { refundedCents: 29900 } });
    const refund = await db.refund.create({
      data: { paymentId: payment.id, amountCents: 29900, reason: "test", actorId: null, actorName: "admin (test)", status: "PENDING", failureReason: "uncertain: timeout" },
    });
    const charge = { id: `ch_${tag}_u`, payment_intent: session().payment_intent, amount: 29900, amount_refunded: 29900, currency: "egp" };
    expect(await deliver("charge.refunded", charge)).toMatchObject({ status: 200 });
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: "SUCCEEDED", failureReason: null });
    expect(await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ refundedCents: 29900, status: "REFUNDED" });
    await db.refund.deleteMany({ where: { paymentId: payment.id } });
  });

  it("acknowledges events it does not handle without claiming them", async () => {
    expect(await deliver("customer.created", { id: "cus_x" })).toMatchObject({ status: 200, outcome: "ignored" });
  });
});
