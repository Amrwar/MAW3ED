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
