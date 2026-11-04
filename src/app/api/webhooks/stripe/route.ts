import type { Payment } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import {
  claimWebhookEvent,
  closeWebhookEvent,
  releaseWebhookEvent,
  failPayment,
  markRefundOutcome,
} from "@/lib/payments/ledger";
import { activateSubscription, releasePendingPlan } from "@/lib/payments/subscription-settle";
import { verifyStripeSignature } from "@/lib/services/stripe";

/**
 * POST /api/webhooks/stripe — the only authority on a Stripe plan payment.
 *
 *   1. The signature is checked against the raw body (Stripe-Signature,
 *      HMAC-SHA256, five-minute window). Anything unsigned: 400.
 *   2. The event id is claimed once (WebhookEvent, unique per provider),
 *      so a redelivery changes nothing.
 *   3. checkout.session.completed / async_payment_succeeded with
 *      payment_status "paid": the session must belong to the payment row
 *      named in its metadata, for the amount and currency that row was
 *      opened for. Then the plan is activated by the same code Paymob's
 *      webhook uses (lib/payments/subscription-settle.ts).
 *      A completed session still "unpaid" (a delayed method) waits for
 *      async_payment_succeeded or _failed.
 *   4. async_payment_failed / expired: the payment fails and the pending
 *      plan is released, so the owner can try again.
 *   5. charge.refunded: a refund issued in the Stripe Dashboard rather than
 *      /admin/payments is recorded on the ledger. The plan is not taken
 *      away: why the money went back is a person's decision, made outside
 *      this system.
 *
 * Only plan payments ever go through Stripe; a session that names
 * anything else is ignored.
 */

type Session = {
  id: string;
  payment_status?: "paid" | "unpaid" | "no_payment_required";
  amount_total?: number | null;
  currency?: string | null;
  payment_intent?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};
type Charge = {
  id: string;
  payment_intent?: string | null;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
};
type StripeEvent = { id: string; type: string; data: { object: unknown } };

const ack = (outcome: string) => Response.json({ received: true, outcome }, { status: 200 });

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"))) {
    log.warn("[stripe webhook] signature verification failed");
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!event?.id || !event.type || !event.data?.object) return Response.json({ error: "invalid event" }, { status: 400 });

  const handled = [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "charge.refunded",
  ];
  if (!handled.includes(event.type)) return ack("ignored");

  if (!(await claimWebhookEvent("STRIPE", event.id, { type: event.type }))) return ack("duplicate");

  try {
    const outcome =
      event.type === "charge.refunded"
        ? await onRefund(event.data.object as Charge)
        : await onSession(event.type, event.data.object as Session);
    await closeWebhookEvent("STRIPE", event.id, outcome);
    return ack(outcome);
  } catch (e) {
    // Nothing was settled (settling is one transaction): give the claim
    // back so Stripe's retry is processed rather than dropped.
    await releaseWebhookEvent("STRIPE", event.id);
    log.error("[stripe webhook] handler failed", { eventId: event.id, type: event.type, e });
    return Response.json({ error: "handler failed" }, { status: 500 });
  }
}

async function paymentForSession(session: Session): Promise<Payment | null> {
  const paymentId = session.metadata?.paymentId ?? session.client_reference_id ?? null;
  if (!paymentId) return null;
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  // The session must be the one this payment opened: metadata alone is
  // what the session was created with, and checking both ties them.
  if (!payment || payment.provider !== "STRIPE" || payment.kind !== "SUBSCRIPTION" || payment.providerOrderId !== session.id) return null;
  return payment;
}

async function onSession(type: string, session: Session): Promise<string> {
  const payment = await paymentForSession(session);
  if (!payment) {
    log.warn("[stripe webhook] no plan payment for session", { sessionId: session.id });
    return "no-matching-payment";
  }

  if (type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") {
    const reason = type === "checkout.session.expired" ? "checkout expired without payment" : "payment failed at Stripe";
    const { changed } = await failPayment({
      paymentId: payment.id,
      reason,
      onFirstFail: (tx, failed) => releasePendingPlan(tx, failed),
    });
    return changed ? "failed" : "already-resolved";
  }

  // completed or async_payment_succeeded
  if (session.payment_status !== "paid") return "awaiting-payment";

  if (session.amount_total !== payment.amountCents || (session.currency ?? "").toUpperCase() !== payment.currency.toUpperCase()) {
    const reason = `amount mismatch: expected ${payment.amountCents} ${payment.currency}, got ${session.amount_total} ${session.currency}`;
    log.error("[stripe webhook] amount or currency mismatch", { paymentId: payment.id, reason });
    await failPayment({ paymentId: payment.id, reason, onFirstFail: (tx, failed) => releasePendingPlan(tx, failed) });
    return "amount-mismatch";
  }

  const transactionId = session.payment_intent ?? session.id;
  return activateSubscription(payment, transactionId, "CARD", "stripe");
}

async function onRefund(charge: Charge): Promise<string> {
  if (!charge.payment_intent) return "no-payment-intent";
  const payment = await db.payment.findFirst({
    where: { provider: "STRIPE", providerTransactionId: charge.payment_intent },
  });
  if (!payment) return "no-matching-payment";
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED" && payment.status !== "REFUNDED") return "not-settled";
  const refunded = Math.min(payment.amountCents, Math.max(0, charge.amount_refunded ?? 0));
  // Raised to what Stripe reports, never lowered and never past the
  // payment: a refund already reserved through /admin/payments is not
  // counted twice.
  const changed = await db.$executeRaw`
    UPDATE "Payment" SET "refundedCents" = ${refunded}
     WHERE "id" = ${payment.id} AND "refundedCents" < ${refunded}`;
  // Refunds asked for through /admin/payments whose answer never came
  // back ("uncertain": the reservation was kept, the row left PENDING) are
  // settled now that Stripe reports the money as returned — the oldest
  // first, as far as what Stripe reports covers them.
  const pending = await db.refund.findMany({
    where: { paymentId: payment.id, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, amountCents: true },
  });
  const confirmedByAdmin = await db.refund.aggregate({
    where: { paymentId: payment.id, status: "SUCCEEDED" },
    _sum: { amountCents: true },
  });
  let room = refunded - (confirmedByAdmin._sum.amountCents ?? 0);
  let settled = 0;
  for (const r of pending) {
    if (r.amountCents > room) break;
    await db.refund.update({ where: { id: r.id }, data: { status: "SUCCEEDED", failureReason: null } });
    room -= r.amountCents;
    settled++;
  }
  if (changed === 0 && settled === 0) {
    // Nothing new, but the status may still lag a reservation that has
    // now been confirmed by Stripe's own figure.
    const p = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { status: true, refundedCents: true } });
    if (p.status === "SUCCEEDED" && p.refundedCents > 0 && p.refundedCents <= refunded) await markRefundOutcome(payment.id);
    return "refund-already-recorded";
  }
  await markRefundOutcome(payment.id);
  log.warn("[stripe webhook] refund recorded from Stripe", { paymentId: payment.id, refundedCents: refunded, settledPendingRefunds: settled });
  return "refund-recorded";
}
