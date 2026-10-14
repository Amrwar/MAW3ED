import { describe, expect, it } from "vitest";
import { classifyCallback, planReversal, shouldReleaseHold, type RefundLine } from "./webhook-rules";

/**
 * The order the Paymob webhook reads a callback in
 * (app/api/webhooks/paymob/route.ts follows classifyCallback exactly).
 */

const payment = { amountCents: 15000, currency: "EGP" };
const base = {
  amount_cents: 15000,
  currency: "EGP",
  is_refunded: false,
  is_voided: false,
  success: true,
  pending: false,
  error_occured: false,
};

describe("classifyCallback", () => {
  it("records a partial refund as a refund, not an amount mismatch", () => {
    // A partial refund from the Paymob dashboard carries the part
    // refunded. Checked after the amount, it was failed as a mismatch
    // and never reached the ledger.
    expect(classifyCallback({ ...base, amount_cents: 5000, is_refunded: true }, payment)).toEqual({ kind: "reversal", reversal: "refund" });
    expect(classifyCallback({ ...base, is_refunded: true }, payment)).toEqual({ kind: "reversal", reversal: "refund" });
    expect(classifyCallback({ ...base, amount_cents: 1, is_voided: true }, payment)).toEqual({ kind: "reversal", reversal: "void" });
  });

  it("refuses money that is not what was asked for", () => {
    expect(classifyCallback({ ...base, amount_cents: 14999 }, payment).kind).toBe("amount-mismatch");
    expect(classifyCallback({ ...base, currency: "USD" }, payment).kind).toBe("currency-mismatch");
    expect(classifyCallback({ ...base, currency: "egp" }, payment).kind).toBe("succeeded");
  });

  it("checks the amount before believing a success", () => {
    expect(classifyCallback({ ...base, amount_cents: 1 }, payment).kind).toBe("amount-mismatch");
  });

  it("tells pending, failed and succeeded apart", () => {
    expect(classifyCallback(base, payment).kind).toBe("succeeded");
    expect(classifyCallback({ ...base, success: false, pending: true }, payment).kind).toBe("pending");
    expect(classifyCallback({ ...base, success: false }, payment).kind).toBe("failed");
    expect(classifyCallback({ ...base, error_occured: true }, payment).kind).toBe("failed");
  });
});

describe("shouldReleaseHold", () => {
  const waiting = { bookingStatus: "PENDING_PAYMENT", failedKind: "BOOKING_DEPOSIT", requiredCents: 3750, otherPaidCents: 0 };

  it("releases a booking whose deposit did not arrive — a decline or a mismatch alike", () => {
    expect(shouldReleaseHold(waiting)).toBe(true);
  });

  it("keeps it when other money already covers the deposit", () => {
    expect(shouldReleaseHold({ ...waiting, otherPaidCents: 3750 })).toBe(false);
    expect(shouldReleaseHold({ ...waiting, otherPaidCents: 3749 })).toBe(true);
  });

  it("never touches a booking somebody already moved on", () => {
    expect(shouldReleaseHold({ ...waiting, bookingStatus: "CONFIRMED" })).toBe(false);
    expect(shouldReleaseHold({ ...waiting, bookingStatus: "CANCELLED" })).toBe(false);
  });

  it("does not unconfirm a booking over a failed balance payment", () => {
    expect(shouldReleaseHold({ ...waiting, failedKind: "BOOKING_BALANCE" })).toBe(false);
  });
});

describe("planReversal", () => {
  const base = { paymentStatus: "PARTIALLY_REFUNDED", amountCents: 3750, refundedCents: 1000, reversedCents: 1000, transactionId: "tx_cb", refunds: [] as RefundLine[] };
  const adminPending: RefundLine = { id: "rf_admin", amountCents: 1000, status: "PENDING", providerRefundId: null, actorId: "admin_1" };

  it("attaches the callback to the admin refund that already reserved it, adding nothing", () => {
    // reserveRefund moved refundedCents before Paymob answered; counting
    // the callback again would refund the same 10.00 twice on paper.
    expect(planReversal({ ...base, refunds: [adminPending] })).toEqual({ kind: "attach", refundId: "rf_admin" });
    expect(planReversal({ ...base, refunds: [{ ...adminPending, status: "SUCCEEDED" }] })).toEqual({ kind: "attach", refundId: "rf_admin" });
    // Even once a full admin refund has made the payment REFUNDED.
    expect(planReversal({ ...base, paymentStatus: "REFUNDED", refunds: [adminPending] }).kind).toBe("attach");
  });

  it("is idempotent once the id is attached", () => {
    const attached = { ...adminPending, providerRefundId: "tx_cb" };
    expect(planReversal({ ...base, refunds: [attached] })).toEqual({ kind: "already-recorded" });
  });

  it("does not match an admin refund for a different amount, or one that failed", () => {
    expect(planReversal({ ...base, reversedCents: 500, refunds: [adminPending] }).kind).toBe("record");
    expect(planReversal({ ...base, refunds: [{ ...adminPending, status: "FAILED" }] }).kind).toBe("record");
    // A refund the callback itself wrote (no actor) is not an admin reservation.
    expect(planReversal({ ...base, refunds: [{ ...adminPending, actorId: null }] }).kind).toBe("record");
  });

  it("records a dashboard refund, never past the amount", () => {
    expect(planReversal({ ...base, reversedCents: 1000 })).toEqual({ kind: "record", addCents: 1000, refundedCents: 2000, status: "PARTIALLY_REFUNDED" });
    expect(planReversal({ ...base, reversedCents: 9999 })).toEqual({ kind: "record", addCents: 2750, refundedCents: 3750, status: "REFUNDED" });
    expect(planReversal({ ...base, paymentStatus: "REFUNDED", refundedCents: 3750 })).toEqual({ kind: "nothing-left" });
  });

  it("refuses a reversal on a payment that never landed", () => {
    for (const s of ["PENDING", "FAILED", "ABANDONED"]) {
      expect(planReversal({ ...base, paymentStatus: s, refundedCents: 0 })).toEqual({ kind: "unsettled" });
    }
  });
});
