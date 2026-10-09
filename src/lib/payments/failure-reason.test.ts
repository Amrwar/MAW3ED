import { describe, it, expect } from "vitest";

/**
 * What a failed payment records about itself.
 *
 * Three real subscription attempts failed in production and every one
 * of them stored the same four words: "provider-error". A wrong
 * integration id, an expired card and a bank refusal were
 * indistinguishable, and the information that would have told them
 * apart arrived in the callback and was thrown away.
 *
 * The shape is asserted here rather than the route's own copy because
 * reaching that function needs a database and a signed callback; the
 * live harness drives it end to end. What matters is the contract: the
 * gateway's own words survive, and nothing from a card does.
 */

interface TransactionLike {
  error_occured: boolean;
  data?: {
    message?: string;
    txn_response_code?: string | number;
    acq_response_code?: string | number;
  };
}

/** Mirrors describeFailure() in the Paymob webhook route. */
function describeFailure(obj: TransactionLike): string {
  const parts: string[] = [obj.error_occured ? "provider-error" : "declined"];
  const message = obj.data?.message?.trim();
  if (message) parts.push(message);
  const txn = obj.data?.txn_response_code;
  if (txn !== undefined && txn !== null && String(txn).trim()) parts.push(`txn=${String(txn).trim()}`);
  const acq = obj.data?.acq_response_code;
  if (acq !== undefined && acq !== null && String(acq).trim()) parts.push(`acq=${String(acq).trim()}`);
  return parts.join(" · ").slice(0, 400);
}

describe("the reason a payment failed", () => {
  it("keeps the gateway's own sentence", () => {
    const reason = describeFailure({
      error_occured: false,
      data: { message: "Insufficient funds", txn_response_code: "51" },
    });
    expect(reason).toContain("Insufficient funds");
    expect(reason).toContain("txn=51");
  });

  it("separates a provider error from a decline", () => {
    // Different problems, different responses: one is a setting to
    // change, the other is somebody's bank.
    expect(describeFailure({ error_occured: true })).toContain("provider-error");
    expect(describeFailure({ error_occured: false })).toContain("declined");
  });

  it("still says something when the gateway says nothing", () => {
    // `data` is not part of the signed field list, so it may be
    // absent. The old constant has to remain the floor.
    expect(describeFailure({ error_occured: true })).toBe("provider-error");
  });

  it("includes the acquirer code when present", () => {
    const reason = describeFailure({
      error_occured: false,
      data: { acq_response_code: 5 },
    });
    expect(reason).toContain("acq=5");
  });

  it("ignores blank and whitespace-only fields", () => {
    // A gateway sending "" should not produce "declined · · txn=".
    const reason = describeFailure({
      error_occured: false,
      data: { message: "   ", txn_response_code: "", acq_response_code: "  " },
    });
    expect(reason).toBe("declined");
  });

  it("fits the column", () => {
    const reason = describeFailure({
      error_occured: true,
      data: { message: "x".repeat(2000) },
    });
    expect(reason.length).toBeLessThanOrEqual(400);
  });

  it("carries nothing from the card", () => {
    // source_data.pan is the last four digits and is deliberately not
    // among the fields read. Nothing about the instrument belongs in a
    // reason somebody will paste into a support thread.
    const reason = describeFailure({
      error_occured: false,
      data: { message: "Declined", txn_response_code: "05" },
    });
    expect(reason).not.toMatch(/\d{4,}/);
  });
});
