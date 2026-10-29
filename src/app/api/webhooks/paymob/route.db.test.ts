import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * The Paymob webhook against a real Postgres: the ledger, the claim
 * table, the booking row and their constraints, with signed callbacks
 * exactly as Paymob sends them. Only the sends are faked (nothing here
 * should email anyone).
 *
 * Needs a LOCAL database with every file in prisma/migrations applied;
 * skipped otherwise:
 *
 *   BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/app/api/webhooks/paymob/route.db.test.ts
 *
 * Everything it creates is tagged p19wh- and removed afterwards.
 */

const url = process.env.BOOKING_DB_TEST_URL;
const local = !!url && /@(localhost|127\.0\.0\.1)[:/]/.test(url);
const SECRET = "p19-webhook-test-secret";

vi.mock("@/lib/notifications", () => ({ notify: vi.fn(async () => []), notifyLater: vi.fn() }));
// The route only takes `err` from here; the real module pulls in
// next-auth, which Vitest cannot resolve.
vi.mock("@/lib/api", () => ({
  err: (message: string, status = 400, extra?: Record<string, unknown>) =>
    Response.json({ error: message, ...(extra ?? {}) }, { status }),
}));

describe.skipIf(!local)("POST /api/webhooks/paymob on a real database", () => {
  let db: PrismaClient;
  let POST: typeof import("./route").POST;
  let moveBooking: typeof import("@/lib/bookings/state").moveBooking;
  let reserveRefund: typeof import("@/lib/payments/ledger").reserveRefund;
  const tag = `p19wh-${Date.now()}`;
  const ids = { users: [] as string[], businesses: [] as string[], webhookIds: [] as string[] };
  let seq = 0;

  function sign(obj: Record<string, unknown>): string {
    const o = obj as { order: { id: unknown }; source_data: { pan: unknown; sub_type: unknown; type: unknown } } & Record<string, unknown>;
    const data = [
      o.amount_cents, o.created_at, o.currency, o.error_occured, o.has_parent_transaction, o.id,
      o.integration_id, o.is_3d_secure, o.is_auth, o.is_capture, o.is_refunded, o.is_standalone_payment,
      o.is_voided, o.order.id, o.owner, o.pending, o.source_data.pan, o.source_data.sub_type,
      o.source_data.type, o.success,
    ].map(String).join("");
    return createHmac("sha512", SECRET).update(data).digest("hex");
  }

  function callback(p: {
    orderId: string;
    amountCents: number;
    txnId?: number;
    success?: boolean;
    pending?: boolean;
    refunded?: boolean;
    currency?: string;
  }) {
    const obj = {
      id: p.txnId ?? Number(`7${String(Date.now()).slice(-8)}${(seq++ % 90) + 10}`),
      pending: p.pending ?? false,
      amount_cents: p.amountCents,
      success: p.success ?? true,
      is_auth: false,
      is_capture: false,
      is_standalone_payment: true,
      is_voided: false,
      is_refunded: p.refunded ?? false,
      is_3d_secure: true,
      integration_id: 0,
      has_parent_transaction: false,
      error_occured: false,
      owner: 0,
      currency: p.currency ?? "EGP",
      created_at: new Date().toISOString(),
      order: { id: Number(p.orderId) },
      source_data: { pan: "4242", type: "card", sub_type: "Visa" },
      data: p.success === false ? { message: "Declined (test)", txn_response_code: "DECLINED" } : {},
    };
    return { type: "TRANSACTION", obj, hmac: sign(obj) };
  }

  async function deliver(body: unknown): Promise<{ status: number } & Record<string, unknown>> {
    const req = new Request("http://localhost/api/webhooks/paymob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req);
    const json = (await res.json()) as Record<string, unknown>;
    const txn = (body as { obj: { id: number } }).obj.id;
    ids.webhookIds.push(String(txn));
    return { status: res.status, ...json };
  }

  let fixture: { businessId: string; serviceId: string; customerId: string };
  const date = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  let slotMinute = 9 * 60;

  /** A booking waiting on a 50 EGP deposit, with its PENDING payment and Paymob order. */
  async function heldBooking() {
    const minute = slotMinute;
    slotMinute += 60;
    const hh = String(Math.floor(minute / 60)).padStart(2, "0");
    const booking = await db.booking.create({
      data: {
        businessId: fixture.businessId,
        serviceId: fixture.serviceId,
        customerId: fixture.customerId,
        customerName: "P19 WH",
        customerPhone: "01000000019",
        date: new Date(`${date}T00:00:00Z`),
        startTime: `${hh}:00`,
        endTime: `${String(Math.floor(minute / 60) + 1).padStart(2, "0")}:00`,
        startsAt: new Date(`${date}T${hh}:00:00Z`),
        endsAt: new Date(new Date(`${date}T${hh}:00:00Z`).getTime() + 3_600_000),
        status: "PENDING_PAYMENT",
        totalPrice: 250,
        depositAmount: 50,
        accessToken: `${tag}-${minute}-${Math.random().toString(16).slice(2)}`,
      },
    });
    const orderId = `9${String(Date.now()).slice(-9)}${String(minute).padStart(3, "0")}`;
    const payment = await db.payment.create({
      data: {
        kind: "BOOKING_DEPOSIT",
        businessId: fixture.businessId,
        bookingId: booking.id,
        amountCents: 5000,
        currency: "EGP",
        provider: "PAYMOB",
        status: "PENDING",
        providerOrderId: orderId,
      },
    });
    return { booking, payment, orderId };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    process.env.PAYMOB_HMAC_SECRET = SECRET;
    ({ db } = (await import("@/lib/db")) as unknown as { db: PrismaClient });
    ({ POST } = await import("./route"));
    ({ moveBooking } = await import("@/lib/bookings/state"));
    ({ reserveRefund } = await import("@/lib/payments/ledger"));

    const [city, category] = await Promise.all([db.city.findFirstOrThrow(), db.category.findFirstOrThrow()]);
    const owner = await db.user.create({ data: { email: `${tag}@example.test`, name: tag } });
    ids.users.push(owner.id);
    const business = await db.business.create({
      data: {
        slug: tag,
        nameAr: tag,
        ownerId: owner.id,
        cityId: city.id,
        categoryId: category.id,
        depositEnabled: true,
        availability: { create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "09:00", closeTime: "21:00" })) },
      },
    });
    ids.businesses.push(business.id);
    const service = await db.service.create({ data: { businessId: business.id, nameAr: "خدمة", duration: 60, price: 250 } });
    const customer = await db.customer.create({ data: { businessId: business.id, name: "زبون", phone: "01000000019" } });
    fixture = { businessId: business.id, serviceId: service.id, customerId: customer.id };
  });

  afterAll(async () => {
    if (!db) return;
    await db.webhookEvent.deleteMany({ where: { provider: "PAYMOB", eventId: { in: ids.webhookIds } } });
    await db.auditLog.deleteMany({ where: { resourceId: { in: (await db.payment.findMany({ where: { businessId: { in: ids.businesses } }, select: { id: true } })).map((p) => p.id) } } });
    // Payments first: a booking payment must name its booking (Payment_target_chk).
    await db.payment.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.booking.deleteMany({ where: { businessId: { in: ids.businesses } } });
    await db.business.deleteMany({ where: { id: { in: ids.businesses } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
  });

  it("refuses an unsigned callback before reading it", async () => {
    const { orderId } = await heldBooking();
    const body = callback({ orderId, amountCents: 5000 });
    body.hmac = "0".repeat(128);
    const res = await deliver(body);
    expect(res.status).toBe(403);
  });

  it("settles a deposit once: the booking confirms, the receipt is numbered, a replay is a no-op", async () => {
    const { booking, payment, orderId } = await heldBooking();
    const body = callback({ orderId, amountCents: 5000 });

    const first = await deliver(body);
    expect(first.outcome).toBe("booking-settled");

    const settled = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(settled.status).toBe("SUCCEEDED");
    expect(settled.receiptNumber).toMatch(/^MW-\d{6}$/);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");

    const replay = await deliver(body);
    expect(replay.duplicate).toBe(true);
    const again = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(again.receiptNumber).toBe(settled.receiptNumber);
    expect(again.updatedAt.getTime()).toBe(settled.updatedAt.getTime());
  });

  it("lets exactly one of five simultaneous deliveries of the same callback settle", async () => {
    const { payment, orderId } = await heldBooking();
    const body = callback({ orderId, amountCents: 5000 });
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => deliver(body)));
    expect(results.filter((r) => r.outcome === "booking-settled")).toHaveLength(1);
    expect(results.filter((r) => r.duplicate === true)).toHaveLength(4);
    const receipts = await db.payment.findMany({ where: { id: payment.id }, select: { receiptNumber: true } });
    expect(receipts[0].receiptNumber).toBeTruthy();
  });

  it("ignores a failure that arrives after the success (out of order)", async () => {
    const { booking, payment, orderId } = await heldBooking();
    await deliver(callback({ orderId, amountCents: 5000 }));
    const late = await deliver(callback({ orderId, amountCents: 5000, success: false }));
    expect(late.outcome).toBe("already-resolved");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
  });

  it("processes the final callback of a wallet payment that first reported pending under the same id", async () => {
    const { booking, orderId } = await heldBooking();
    const txnId = Number(`71${String(Date.now()).slice(-9)}`);
    const first = await deliver(callback({ orderId, amountCents: 5000, txnId, pending: true, success: false }));
    expect(first.outcome).toBe("still-pending");
    expect(await db.webhookEvent.count({ where: { provider: "PAYMOB", eventId: String(txnId) } })).toBe(0);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("PENDING_PAYMENT");

    const final = await deliver(callback({ orderId, amountCents: 5000, txnId }));
    expect(final.outcome).toBe("booking-settled");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
  });

  it("releases the time on a decline, then revives the booking if a late payment finds it still free", async () => {
    const { booking, payment, orderId } = await heldBooking();
    const declined = await deliver(callback({ orderId, amountCents: 5000, success: false }));
    expect(declined.outcome).toBe("failed");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("FAILED_PAYMENT");

    const late = await deliver(callback({ orderId, amountCents: 5000 }));
    expect(late.outcome).toBe("booking-revived");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CONFIRMED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
  });

  it("records money that lands after the customer cancelled, without reviving the booking", async () => {
    const { booking, payment, orderId } = await heldBooking();
    const move = await moveBooking({ bookingId: booking.id, from: "PENDING_PAYMENT", to: "CANCELLED", by: "customer" });
    expect(move.moved).toBe(true);
    // Cancelling closed the payment page in the ledger.
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("ABANDONED");

    const res = await deliver(callback({ orderId, amountCents: 5000 }));
    expect(res.outcome).toBe("booking-settled");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("SUCCEEDED");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("CANCELLED");
    const flagged = await db.auditLog.findFirst({ where: { action: "payment.unexpected_deposit", resourceId: payment.id } });
    expect(flagged).not.toBeNull();
  });

  it("fails a callback whose amount is not what was asked for, and gives the time back", async () => {
    const { booking, payment, orderId } = await heldBooking();
    const res = await deliver(callback({ orderId, amountCents: 100 }));
    expect(res.outcome).toBe("amount-mismatch");
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("FAILED");
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("FAILED_PAYMENT");
  });

  it("reserves a refund once under contention, and attaches the provider's callback to it", async () => {
    const { payment, orderId } = await heldBooking();
    await deliver(callback({ orderId, amountCents: 5000 }));

    // Two admins refund the whole amount at the same moment.
    const [a, b] = await Promise.all([reserveRefund(payment.id, 5000), reserveRefund(payment.id, 5000)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const owner = await db.user.findFirstOrThrow({ where: { id: ids.users[0] } });
    const refund = await db.refund.create({
      data: { paymentId: payment.id, amountCents: 5000, reason: "test", actorId: owner.id, actorName: "admin", status: "PENDING", failureReason: "uncertain: timeout" },
    });

    // Paymob's own callback for the refund arrives: the pending row is
    // the one it belongs to, so it is settled rather than counted twice.
    const res = await deliver(callback({ orderId, amountCents: 5000, refunded: true }));
    expect(res.outcome).toBe("reversal-matched-admin-refund");
    const settledRefund = await db.refund.findUniqueOrThrow({ where: { id: refund.id } });
    expect(settledRefund.status).toBe("SUCCEEDED");
    expect(settledRefund.providerRefundId).not.toBeNull();
    const p = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(p.status).toBe("REFUNDED");
    expect(p.refundedCents).toBe(5000);

    // The same reversal again changes nothing.
    const again = await deliver(callback({ orderId, amountCents: 5000, refunded: true, txnId: Number(settledRefund.providerRefundId) }));
    expect(again.duplicate).toBe(true);
    expect((await db.payment.findUniqueOrThrow({ where: { id: payment.id } })).refundedCents).toBe(5000);
  });
});
