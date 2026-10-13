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
    // The ids come from an unverified payload, so they are logged as a
    // lead to follow, never acted on. Without them a rejected delivery
    // cannot be tied to the customer saying they paid and nothing
    // happened, which is the only moment anybody reads this line.
    log.warn("[paymob webhook] HMAC verification failed", {
      claimedOrderId: String(obj.order?.id ?? "none").slice(0, 32),
      claimedTransactionId: String(obj.id ?? "none").slice(0, 32),
      hmacLength: hmac.length,
    });
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

  // ── 5. The currency is ours too ─────────────────────────────────────────
  //
  // amount_cents is a number with no unit attached. 28550 piastres and
  // 28550 cents of something else are the same integer, so checking the
  // amount alone would settle a 285.50 EGP booking against a payment
  // taken in another currency.
  //
  // In practice Paymob charges in whatever the integration is
  // configured for, so this should never fire. It is checked for the
  // same reason the amount is: the field is in the HMAC-signed payload,
  // so it is authentic and free to verify, and a confirmation is a
  // promise to both the customer and the business.
  if (obj.currency && obj.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    log.error("[paymob webhook] currency mismatch", {
      paymentId: payment.id,
      expected: payment.currency,
      received: obj.currency,
    });
    await failPayment({
      paymentId: payment.id,
      reason: `currency mismatch: expected ${payment.currency}, got ${obj.currency}`,
      providerTransactionId: transactionId,
    });
    return "currency-mismatch";
  }

  // ── 6. Money that has gone back ─────────────────────────────────────────
  //
  // Paymob sends a TRANSACTION callback for a refund or a void as well,
  // with success still true and is_refunded or is_voided set. Read as a
  // payment, that is an already-settled no-op — so a refund issued from
  // the Paymob dashboard, rather than through /admin/payments, never
  // reached the ledger and the payment went on reading SUCCEEDED.
  //
  // It is recorded rather than acted on: the booking is not cancelled
  // here, because why the money went back is a decision somebody made
  // outside this system and the ledger should reflect it, not guess at
  // its intent.
  if (obj.is_refunded || obj.is_voided) {
    return reconcileReversal(payment, obj, transactionId);
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

/**
 * A refund or a void that happened at the provider, not here.
 *
 * /admin/payments records its own refunds as it issues them. This is
 * for the other direction: somebody refunds or voids in the Paymob
 * dashboard, and without this the ledger never hears about it — the
 * payment keeps reading SUCCEEDED and the business's takings are
 * overstated for as long as nobody reconciles by hand.
 *
 * A Refund row is written so the money is accounted for, attributed to
 * the provider rather than to an admin who did not do it. The booking
 * is deliberately left alone: a refund can mean a cancellation, a
 * goodwill gesture or a correction, and inferring which from a boolean
 * would be guessing at somebody's intent.
 */
async function reconcileReversal(
  payment: Payment,
  obj: PaymobTransactionObj,
  transactionId: string,
): Promise<string> {
  const kind = obj.is_voided ? "void" : "refund";

  // Paymob reports the reversed amount on the transaction. Fall back to
  // the full payment, since a void is always for the whole of it.
  const amountCents = Math.min(
    Math.abs(obj.amount_cents || payment.amountCents),
    payment.amountCents,
  );

  const already = await db.refund.findFirst({
    where: { paymentId: payment.id, providerRefundId: transactionId },
    select: { id: true },
  });
  // The webhook-event guard already stops a replay of the same
  // delivery; this stops a second delivery with a new event id from
  // double-counting the same reversal.
  if (already) return "reversal-already-recorded";

  await db.$transaction(async (tx) => {
    await tx.refund.create({
      data: {
        paymentId: payment.id,
        amountCents,
        status: "SUCCEEDED",
        providerRefundId: transactionId,
        reason: `${kind} recorded from Paymob callback`,
        // No actor: nobody in this system did it.
        actorName: "Paymob",
      },
    });

    const refundedTotal = Math.min(payment.refundedCents + amountCents, payment.amountCents);
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedCents: refundedTotal,
        status: refundedTotal >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
  });

  log.warn("[paymob webhook] reversal reconciled from provider", {
    paymentId: payment.id,
    kind,
    amountCents,
  });

  return `reversal-${kind}`;
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
  // What the booking was when the money landed; read inside the
  // settlement so it is consistent with it.
  let before: string | null = null;

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
      before = booking.status;

      // Only a booking waiting on this money is confirmed by it. A
      // balance arriving for somebody already in the chair must not set
      // them back to CONFIRMED, and nothing drags a cancelled or
      // finished booking back to life.
      if (booking.status !== "PENDING_PAYMENT") return;

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

  // Deliberately info and deliberately boring: ids and figures, no
  // customer name, no card data. source_data.pan is the last four
  // digits and is still not logged — there is no question this line
  // answers that needs it.
  log.info("[paymob webhook] booking payment settled", {
    paymentId: payment.id,
    bookingId: payment.bookingId,
    businessId: payment.businessId,
    kind: payment.kind,
    amountCents: payment.amountCents,
    currency: payment.currency,
    transactionId,
    method: methodOf(obj),
  });

  // Paid after the hold was released — the customer closed the app and
  // paid late, or the webhook was delayed past the reaper. The money is
  // already recorded (above, in its own transaction, so it can never be
  // lost to what follows). The booking is revived only if its time is
  // still free: the exclusion constraint decides, and a time somebody
  // else has taken since is left with them.
  let revived = false;
  if (payment.bookingId && before === "FAILED_PAYMENT") {
    try {
      const { count } = await db.booking.updateMany({
        where: { id: payment.bookingId, status: "FAILED_PAYMENT" },
        data: { status: "CONFIRMED", paymobTransactionId: transactionId },
      });
      revived = count === 1;
    } catch (e) {
      log.error("[paymob webhook] paid after the slot was released and retaken — needs a refund or a new time", {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        error: e instanceof Error ? e.message.slice(0, 120) : String(e),
      });
    }
    if (!revived) {
      await db.auditLog
        .create({
          data: {
            actorName: "Paymob",
            actorRole: "system",
            action: "payment.paid_after_release",
            resourceType: "Payment",
            resourceId: payment.id,
            summary: "Deposit paid after the booking's time was released and taken; refund or rebook needed.",
            metadata: { bookingId: payment.bookingId, transactionId, amountCents: payment.amountCents },
          },
        })
        .catch((e) => log.error("[paymob webhook] could not write audit entry", e));
      // The customer is told the money arrived; the booking screen says
      // the time was released and support will sort it out.
      void notify({ type: "payment.received", bookingId: payment.bookingId, amount: payment.amountCents / 100, transactionId });
      return "paid-after-release";
    }
  }

  if (payment.bookingId) {
    // The transaction id goes into the event so a retry computes the
    // same deduplication key and the customer is not thanked twice.
    void notify({
      type: "payment.received",
      bookingId: payment.bookingId,
      amount: payment.amountCents / 100,
      transactionId,
    });
    if (payment.kind !== "BOOKING_BALANCE" && (before === "PENDING_PAYMENT" || revived)) {
      void notify({ type: "booking.confirmed", bookingId: payment.bookingId });
    }
  }

  return revived ? "booking-revived" : "booking-settled";
}

/**
 * Why a payment failed, in words somebody can act on.
 *
 * This used to be the constant "provider-error", which is how three
 * real subscription attempts came to be recorded with no indication of
 * what went wrong — a wrong integration id, an expired card and a bank
 * refusal all looked identical, and the information needed to tell them
 * apart was discarded on arrival.
 *
 * Paymob puts its account of the failure in `obj.data`. None of it is
 * card data: `message` is a sentence like "Insufficient funds" and the
 * codes are the acquirer's. Capped, because failureReason is a column
 * and a gateway can be verbose.
 */
function describeFailure(obj: PaymobTransactionObj): string {
  const parts: string[] = [obj.error_occured ? "provider-error" : "declined"];

  const message = obj.data?.message?.trim();
  if (message) parts.push(message);

  const txn = obj.data?.txn_response_code;
  if (txn !== undefined && txn !== null && String(txn).trim()) {
    parts.push(`txn=${String(txn).trim()}`);
  }

  const acq = obj.data?.acq_response_code;
  if (acq !== undefined && acq !== null && String(acq).trim()) {
    parts.push(`acq=${String(acq).trim()}`);
  }

  return parts.join(" · ").slice(0, 400);
}

async function handleFailure(
  payment: Payment,
  obj: PaymobTransactionObj,
  transactionId: string,
): Promise<string> {
  const reason = describeFailure(obj);

  // Logged as well as stored, because the stored reason is truncated to
  // fit a column and this is the moment somebody will be reading the
  // logs — a customer has just told them a payment did not work.
  log.error("[paymob webhook] payment failed", {
    paymentId: payment.id,
    kind: payment.kind,
    businessId: payment.businessId,
    transactionId,
    amountCents: payment.amountCents,
    errorOccured: obj.error_occured,
    // The gateway's own words and codes. No card data: `pan` is the
    // last four digits and is still not logged.
    gatewayMessage: obj.data?.message ?? null,
    txnResponseCode: obj.data?.txn_response_code ?? null,
    acqResponseCode: obj.data?.acq_response_code ?? null,
    integrationId: obj.integration_id,
    sourceType: obj.source_data?.type ?? null,
  });

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
