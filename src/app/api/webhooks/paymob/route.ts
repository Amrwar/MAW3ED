/**
 * POST /api/webhooks/paymob
 *
 * The only thing in the application allowed to decide that money
 * arrived. Nothing a browser says about a payment is believed; this is
 * where payment state is written, and it writes it from a signed
 * callback and nowhere else.
 *
 * Order of business, and none of it is optional:
 *
 *   1. Verify the HMAC. An unsigned or wrongly signed callback is
 *      refused before anything is read out of it.
 *   2. Claim the delivery by Paymob's own transaction id. Paymob
 *      retries anything it did not hear a clean 200 for, and two
 *      retries can land at once; the unique index decides which one
 *      proceeds and the other does nothing.
 *   3. Find the payment by the provider's order id.
 *   4. Check the amount is the amount we asked for.
 *   5. Settle or fail it, with the booking or the subscription moving
 *      in the same transaction.
 *
 * Configure in Paymob: Settings → Transaction processed callback →
 * https://your-domain/api/webhooks/paymob
 */

import type { Prisma, Payment } from "@prisma/client";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { verifyWebhookHmac, type PaymobTransactionObj } from "@/lib/services/paymob";
import {
  claimWebhookEvent,
  closeWebhookEvent,
  failPayment,
  settlePayment,
} from "@/lib/payments/ledger";
import { renewalPeriodEnd } from "@/lib/payments/subscription";
import type { Plan } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

interface PaymobWebhookBody {
  type?: string;
  obj?: PaymobTransactionObj;
  hmac?: string;
}

/** Always 200: an error code makes Paymob retry a delivery we handled. */
function ack(extra: Record<string, unknown> = {}) {
  return Response.json({ received: true, ...extra }, { status: 200 });
}

export async function POST(req: Request) {
  let body: PaymobWebhookBody;

  try {
    body = await req.json();
  } catch (e) {
    // A callback we cannot parse means a customer may have paid for a
    // booking that never got confirmed. That must leave a trace.
    log.error("paymob webhook: unparseable payload", e);
    return err("invalid JSON", 400);
  }

  if (body.type !== "TRANSACTION") return ack();

  const obj = body.obj;
  const hmac = body.hmac ?? new URL(req.url).searchParams.get("hmac") ?? "";
  if (!obj) return err("missing transaction object", 400);

  // ── 1. Signature ──────────────────────────────────────────────────────────
  if (!verifyWebhookHmac(obj, hmac)) {
    log.warn("[paymob webhook] HMAC verification failed");
    return err("invalid signature", 403);
  }

  const transactionId = String(obj.id);
  const providerOrderId = String(obj.order.id);

  // ── 2. Idempotency ────────────────────────────────────────────────────────
  const fresh = await claimWebhookEvent("PAYMOB", transactionId, body);
  if (!fresh) return ack({ duplicate: true });

  try {
    const outcome = await handle(obj, providerOrderId, transactionId);
    await closeWebhookEvent("PAYMOB", transactionId, outcome);
    return ack({ outcome });
  } catch (e) {
    // The delivery stays claimed and unprocessed, which is what a human
    // looks for when a customer says they paid and nothing happened.
    log.error("[paymob webhook] handler threw", e);
    await closeWebhookEvent("PAYMOB", transactionId, "error");
    return ack({ outcome: "error" });
  }
}

// ─── Routing one transaction to its payment ───────────────────────────────────

async function handle(
  obj: PaymobTransactionObj,
  providerOrderId: string,
  transactionId: string,
): Promise<string> {
  const payment = await findPayment(providerOrderId);

  if (!payment) {
    log.warn("paymob webhook: no payment for order", { providerOrderId });
    return "no-matching-payment";
  }

  // ── 4. The amount is ours, not theirs ───────────────────────────────────
  //
  // Paymob sends what was charged. If that is not what we opened the
  // payment for, something is wrong on one side or the other and the
  // booking must not be confirmed on the strength of it.
  if (obj.amount_cents !== payment.amountCents) {
    log.error("[paymob webhook] amount mismatch", {
      paymentId: payment.id,
      expected: payment.amountCents,
      received: obj.amount_cents,
    });
    await failPayment({
      paymentId: payment.id,
      reason: `amount mismatch: expected ${payment.amountCents}, got ${obj.amount_cents}`,
      providerTransactionId: transactionId,
    });
    return "amount-mismatch";
  }

  const succeeded = obj.success && !obj.pending && !obj.error_occured;

  if (!succeeded) {
    if (obj.pending) return "still-pending";
    return handleFailure(payment, obj, transactionId);
  }

  return payment.kind === "SUBSCRIPTION"
    ? handleSubscriptionSuccess(payment, transactionId, obj)
    : handleBookingSuccess(payment, transactionId, obj);
}

/**
 * Payments opened before the ledger existed have no Payment row, only
 * an order id on the booking or the business. Those are adopted into
 * the ledger on the way through rather than being left unhandled.
 */
async function findPayment(providerOrderId: string): Promise<Payment | null> {
  const existing = await db.payment.findUnique({ where: { providerOrderId } });
  if (existing) return existing;

  const booking = await db.booking.findFirst({
    where: { paymobOrderId: providerOrderId },
    select: { id: true, businessId: true, depositAmount: true, totalPrice: true },
  });
  if (booking) {
    const amount = Number(booking.depositAmount ?? booking.totalPrice);
    return db.payment.create({
      data: {
        kind: booking.depositAmount != null ? "BOOKING_DEPOSIT" : "BOOKING_FULL",
        businessId: booking.businessId,
        bookingId: booking.id,
        amountCents: Math.round(amount * 100),
        providerOrderId,
        status: "PENDING",
      },
    });
  }

  const business = await db.business.findFirst({
    where: { subscriptionPaymobOrderId: providerOrderId },
    select: { id: true, pendingPlan: true },
  });
  if (business?.pendingPlan && business.pendingPlan !== "FREE") {
    const { PLAN_PRICES_CENTS } = await import("@/lib/plans");
    return db.payment.create({
      data: {
        kind: "SUBSCRIPTION",
        businessId: business.id,
        plan: business.pendingPlan,
        amountCents: PLAN_PRICES_CENTS[business.pendingPlan as "PRO" | "PREMIUM"],
        providerOrderId,
        status: "PENDING",
      },
    });
  }

  return null;
}

function methodOf(obj: PaymobTransactionObj) {
  const type = (obj.source_data?.type ?? "").toLowerCase();
  if (type.includes("card")) return "CARD" as const;
  if (type.includes("wallet")) return "WALLET" as const;
  return "OTHER" as const;
}

// ─── Booking ──────────────────────────────────────────────────────────────────

async function handleBookingSuccess(
  payment: Payment,
  transactionId: string,
  obj: PaymobTransactionObj,
): Promise<string> {
  const { changed } = await settlePayment({
    paymentId: payment.id,
    providerTransactionId: transactionId,
    method: methodOf(obj),
    onFirstSettle: async (tx, settled) => {
      if (!settled.bookingId) return;

      const booking = await tx.booking.findUnique({
        where: { id: settled.bookingId },
        select: { status: true },
      });
      if (!booking) return;

      // The balance arriving does not re-confirm an already confirmed
      // booking, and nothing drags a cancelled one back to life.
      const terminal = ["COMPLETED", "CANCELLED", "NO_SHOW"];
      if (terminal.includes(booking.status)) return;

      await tx.booking.update({
        where: { id: settled.bookingId },
        data: {
          status: "CONFIRMED",
          // Kept in step for anything still reading the old columns.
          paymobTransactionId: transactionId,
        },
      });
    },
  });

  if (!changed) return "already-settled";

  if (payment.bookingId) {
    // The transaction id goes into the event so a retry computes the
    // same deduplication key and the customer is not thanked twice.
    void notify({
      type: "payment.received",
      bookingId: payment.bookingId,
      amount: payment.amountCents / 100,
      transactionId,
    });
    if (payment.kind !== "BOOKING_BALANCE") {
      void notify({ type: "booking.confirmed", bookingId: payment.bookingId });
    }
  }

  return "booking-settled";
}

async function handleFailure(
  payment: Payment,
  obj: PaymobTransactionObj,
  transactionId: string,
): Promise<string> {
  const reason = obj.error_occured ? "provider-error" : "declined";

  const { changed } = await failPayment({
    paymentId: payment.id,
    reason,
    providerTransactionId: transactionId,
    onFirstFail: async (tx, failed) => {
      if (failed.kind === "SUBSCRIPTION") {
        // Let go of the pending plan so the owner can try again.
        await tx.business.update({
          where: { id: failed.businessId },
          data: { pendingPlan: null, subscriptionPaymobOrderId: null },
        });
        return;
      }

      if (!failed.bookingId) return;
      const booking = await tx.booking.findUnique({
        where: { id: failed.bookingId },
        select: { status: true },
      });
      // A failed balance payment does not unconfirm a booking that the
      // deposit already paid for.
      if (failed.kind === "BOOKING_BALANCE") return;
      if (!booking || booking.status !== "PENDING_PAYMENT") return;

      await tx.booking.update({
        where: { id: failed.bookingId },
        data: { status: "FAILED_PAYMENT" },
      });
    },
  });

  if (!changed) return "already-resolved";

  if (payment.bookingId) {
    void notify({ type: "payment.failed", bookingId: payment.bookingId, reason });
  }

  return "failed";
}

// ─── Subscription ─────────────────────────────────────────────────────────────

async function handleSubscriptionSuccess(
  payment: Payment,
  transactionId: string,
  obj: PaymobTransactionObj,
): Promise<string> {
  const plan = payment.plan as Plan | null;
  if (!plan || plan === "FREE") {
    log.warn("paymob webhook: subscription payment with no plan", { paymentId: payment.id });
    return "subscription-without-plan";
  }

  // A holder, because control-flow analysis cannot see that the
  // settle callback runs before this is read.
  const period: { until: Date | null } = { until: null };

  const { changed } = await settlePayment({
    paymentId: payment.id,
    providerTransactionId: transactionId,
    method: methodOf(obj),
    onFirstSettle: async (tx, settled) => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id: settled.businessId },
        select: { currentPeriodEnd: true, referredById: true, referralRewardedAt: true },
      });

      // Extends from whatever is left, not from today — renewing early
      // used to forfeit the remaining days, which is why the upgrade
      // route had to refuse renewals more than a week out.
      period.until = renewalPeriodEnd(business.currentPeriodEnd);

      await tx.business.update({
        where: { id: settled.businessId },
        data: {
          plan,
          subscriptionStatus: "ACTIVE",
          currentPeriodEnd: period.until,
          pendingPlan: null,
          subscriptionPaymobOrderId: null,
          subscriptionReminderSentAt: null,
        },
      });

      await rewardReferrer(tx, settled.businessId, business);
    },
  });

  if (!changed) return "already-settled";

  log.info("[paymob webhook] subscription activated", {
    businessId: payment.businessId,
    plan,
    until: period.until?.toISOString(),
  });

  if (period.until) {
    void notify({
      type: "subscription.renewed",
      businessId: payment.businessId,
      until: period.until,
    });
  }

  return "subscription-settled";
}

/**
 * A business whose referral finally paid gets the referrer 30 days.
 *
 * Inside the settlement transaction, and guarded by referralRewardedAt,
 * so a replay cannot hand out the reward twice.
 */
async function rewardReferrer(
  tx: Prisma.TransactionClient,
  businessId: string,
  business: { referredById: string | null; referralRewardedAt: Date | null },
): Promise<void> {
  if (!business.referredById || business.referralRewardedAt) return;

  const referrer = await tx.business.findUnique({
    where: { id: business.referredById },
    select: { id: true, currentPeriodEnd: true },
  });
  if (!referrer) return;

  await tx.business.update({
    where: { id: referrer.id },
    data: { currentPeriodEnd: renewalPeriodEnd(referrer.currentPeriodEnd) },
  });
  await tx.business.update({
    where: { id: businessId },
    data: { referralRewardedAt: new Date() },
  });

  log.info("[referral reward] 30 days added", { referrerId: referrer.id });
}
