import { describe, expect, it } from "vitest";
import { classifyCallback, shouldReleaseHold } from "./webhook-rules";

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
