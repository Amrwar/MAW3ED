import type { PaymobTransactionObj } from "@/lib/services/paymob";

/**
 * What a verified Paymob callback means for the payment it names.
 *
 * Pure, so the order of the checks can be pinned by a test: the route
 * (app/api/webhooks/paymob) does exactly what this says, in this order.
 *
 * Reversals come first. A refund or void callback carries the reversed
 * amount, which for a partial refund is not the amount the payment was
 * opened for — checked after the amount, a partial refund made in the
 * Paymob dashboard was read as an "amount mismatch", failed nothing (the
 * payment had already succeeded) and was never recorded as a refund.
 */
export type CallbackVerdict =
  | { kind: "reversal"; reversal: "refund" | "void" }
  | { kind: "amount-mismatch" }
  | { kind: "currency-mismatch" }
  | { kind: "pending" }
  | { kind: "failed" }
  | { kind: "succeeded" };

export function classifyCallback(
  obj: Pick<PaymobTransactionObj, "amount_cents" | "currency" | "is_refunded" | "is_voided" | "success" | "pending" | "error_occured">,
  payment: { amountCents: number; currency: string },
): CallbackVerdict {
  if (obj.is_refunded || obj.is_voided) {
    return { kind: "reversal", reversal: obj.is_voided ? "void" : "refund" };
  }
  if (obj.amount_cents !== payment.amountCents) return { kind: "amount-mismatch" };
  if (obj.currency && obj.currency.toUpperCase() !== payment.currency.toUpperCase()) {
    return { kind: "currency-mismatch" };
  }
  const succeeded = obj.success && !obj.pending && !obj.error_occured;
  if (succeeded) return { kind: "succeeded" };
  if (obj.pending) return { kind: "pending" };
  return { kind: "failed" };
}

/**
 * Whether a booking still waiting on its deposit should be released
 * after a payment for it failed (declined, or a callback whose amount or
 * currency was not ours).
 *
 * Not when other money that already arrived covers what was asked for —
 * the deposit, or the whole price when no deposit was set — and never a
 * booking that is not PENDING_PAYMENT, which somebody else moved on.
 */
export function shouldReleaseHold(params: {
  bookingStatus: string;
  failedKind: string;
  /** What was asked for up front, in piastres. */
  requiredCents: number;
  /** Net money from other payments that already landed, in piastres. */
  otherPaidCents: number;
}): boolean {
  if (params.failedKind === "BOOKING_BALANCE") return false;
  if (params.bookingStatus !== "PENDING_PAYMENT") return false;
  return params.otherPaidCents < params.requiredCents;
}

/** A Refund row, as reconciling a provider reversal needs to see it. */
export interface RefundLine {
  id: string;
  amountCents: number;
  status: string;
  providerRefundId: string | null;
  /** Set for a refund an admin issued from /admin/payments. */
  actorId: string | null;
}

export type ReversalPlan =
  /** This reversal is already on the ledger. */
  | { kind: "already-recorded" }
  /** The payment never landed; there is nothing to reverse. */
  | { kind: "unsettled" }
  /** It is the callback for an admin refund already reserved: attach the id, add nothing. */
  | { kind: "attach"; refundId: string }
  /** A reversal made outside Maw3ed: record it. */
  | { kind: "record"; addCents: number; refundedCents: number; status: "REFUNDED" | "PARTIALLY_REFUNDED" }
  /** Made outside Maw3ed, but the payment is already fully refunded. */
  | { kind: "nothing-left" };

/**
 * What a refund or void callback from Paymob does to the ledger.
 *
 * An admin refund reserves its amount (refundedCents) before Paymob is
 * asked, and may not know Paymob's id until after the callback has
 * arrived — or ever. So a callback for the same amount on a payment
 * with an admin refund still waiting for its id is that refund: the id
 * is attached and nothing is added, since the money is already counted.
 * Only a reversal nobody here made is added, and never past the amount.
 *
 * A payment that never landed (PENDING, FAILED, ABANDONED) is not
 * reversed: marking it refunded would make it count as money that
 * arrived, and settle() would then refuse the real success.
 */
export function planReversal(params: {
  paymentStatus: string;
  amountCents: number;
  refundedCents: number;
  reversedCents: number;
  transactionId: string;
  refunds: readonly RefundLine[];
}): ReversalPlan {
  const { paymentStatus, amountCents, refundedCents, reversedCents, transactionId, refunds } = params;

  if (refunds.some((r) => r.providerRefundId === transactionId)) return { kind: "already-recorded" };

  const landed = paymentStatus === "SUCCEEDED" || paymentStatus === "PARTIALLY_REFUNDED" || paymentStatus === "REFUNDED";
  if (!landed) return { kind: "unsettled" };

  const reserved = refunds.find(
    (r) => r.actorId !== null && r.providerRefundId === null && r.amountCents === reversedCents && (r.status === "PENDING" || r.status === "SUCCEEDED"),
  );
  if (reserved) return { kind: "attach", refundId: reserved.id };

  const addCents = Math.max(0, Math.min(reversedCents, amountCents - refundedCents));
  if (addCents === 0) return { kind: "nothing-left" };
  const total = refundedCents + addCents;
  return { kind: "record", addCents, refundedCents: total, status: total >= amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED" };
}
