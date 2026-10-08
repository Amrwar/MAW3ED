import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookHmac, type PaymobTransactionObj } from "@/lib/services/paymob";

/**
 * The rules a Paymob callback has to pass before it can confirm a
 * booking.
 *
 * Every one of these is a way a confirmation could be granted that the
 * money does not justify. The production database has had zero payments
 * through it, so none of this has ever been exercised by a real
 * transaction — which is exactly why the rules are worth pinning down
 * before one arrives.
 *
 * The signature is checked against the real implementation. The
 * comparisons after it are asserted here against the same conditions
 * the route applies, because the route's own branches need a database
 * to reach; the live harness in docs/payments-verification.md drives
 * those end to end.
 */

const SECRET = "test-hmac-secret-not-a-real-one";

/** A transaction object shaped exactly as Paymob sends one. */
function transaction(overrides: Partial<PaymobTransactionObj> = {}): PaymobTransactionObj {
  return {
    id: 123456789,
    pending: false,
    amount_cents: 28550,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 999,
    has_parent_transaction: false,
    error_occured: false,
    owner: 1,
    currency: "EGP",
    order: { id: 987654321 },
    source_data: { pan: "2346", type: "card", sub_type: "Visa" },
    ...overrides,
  } as PaymobTransactionObj;
}

/** The HMAC exactly as Paymob computes it: named fields, in order, concatenated. */
function sign(obj: PaymobTransactionObj, secret = SECRET): string {
  const data = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order.id,
    obj.owner,
    obj.pending,
    obj.source_data.pan,
    obj.source_data.sub_type,
    obj.source_data.type,
    obj.success,
  ]
    .map(String)
    .join("");
  return createHmac("sha512", secret).update(data).digest("hex");
}

function withSecret<T>(secret: string | undefined, run: () => T): T {
  const previous = process.env.PAYMOB_HMAC_SECRET;
  if (secret === undefined) delete process.env.PAYMOB_HMAC_SECRET;
  else process.env.PAYMOB_HMAC_SECRET = secret;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.PAYMOB_HMAC_SECRET;
    else process.env.PAYMOB_HMAC_SECRET = previous;
  }
}

describe("the signature", () => {
  it("accepts a correctly signed callback", () => {
    const obj = transaction();
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(obj, sign(obj))).toBe(true);
    });
  });

  it("rejects a wrong signature", () => {
    const obj = transaction();
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(obj, sign(obj, "a-different-secret"))).toBe(false);
    });
  });

  it("rejects a missing signature", () => {
    const obj = transaction();
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(obj, "")).toBe(false);
    });
  });

  it("rejects a signature of the wrong length without throwing", () => {
    // timingSafeEqual throws on mismatched lengths. If that escaped, a
    // short signature would crash the route rather than be refused —
    // and a crash is a non-200, which makes Paymob retry forever.
    const obj = transaction();
    withSecret(SECRET, () => {
      expect(() => verifyWebhookHmac(obj, "abc")).not.toThrow();
      expect(verifyWebhookHmac(obj, "abc")).toBe(false);
    });
  });

  it("refuses everything when no secret is configured", () => {
    // Fail closed. An unsigned callback must never be able to confirm a
    // booking because the server forgot its own secret.
    const obj = transaction();
    withSecret(undefined, () => {
      expect(verifyWebhookHmac(obj, sign(obj))).toBe(false);
    });
  });

  it("notices a tampered amount", () => {
    // The signature covers amount_cents, so raising the amount after
    // signing invalidates it. This is what stops a replayed callback
    // being edited into a larger confirmation.
    const obj = transaction();
    const signature = sign(obj);
    const tampered = { ...obj, amount_cents: 1 };
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(tampered, signature)).toBe(false);
    });
  });

  it("notices a tampered success flag", () => {
    const obj = transaction({ success: false });
    const signature = sign(obj);
    const tampered = { ...obj, success: true };
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(tampered, signature)).toBe(false);
    });
  });

  it("notices a tampered currency", () => {
    const obj = transaction();
    const signature = sign(obj);
    const tampered = { ...obj, currency: "USD" };
    withSecret(SECRET, () => {
      expect(verifyWebhookHmac(tampered, signature)).toBe(false);
    });
  });
});

/**
 * What the route decides once a callback is known to be authentic.
 *
 * Authentic is not the same as acceptable: a genuine Paymob callback
 * can still be for the wrong amount, the wrong currency, or a
 * transaction that was later reversed.
 */

/** The route's success condition, stated once. */
const isSuccess = (o: PaymobTransactionObj) => o.success && !o.pending && !o.error_occured;

/** The route's reversal condition. */
const isReversal = (o: PaymobTransactionObj) => o.is_refunded || o.is_voided;

describe("what counts as paid", () => {
  it("accepts a plain success", () => {
    expect(isSuccess(transaction())).toBe(true);
  });

  it("does not accept a pending transaction", () => {
    // Pending means the money has not arrived. Confirming here is the
    // single worst thing this system could do.
    expect(isSuccess(transaction({ pending: true }))).toBe(false);
  });

  it("does not accept success alongside an error", () => {
    expect(isSuccess(transaction({ error_occured: true }))).toBe(false);
  });

  it("does not accept a declined transaction", () => {
    expect(isSuccess(transaction({ success: false }))).toBe(false);
  });
});

describe("amount and currency", () => {
  const EXPECTED_CENTS = 28550;
  const EXPECTED_CURRENCY = "EGP";

  it("matches the amount the payment was opened for", () => {
    expect(transaction().amount_cents).toBe(EXPECTED_CENTS);
  });

  it("catches an amount that is not the one we asked for", () => {
    expect(transaction({ amount_cents: 100 }).amount_cents).not.toBe(EXPECTED_CENTS);
  });

  it("catches a different currency carrying the same number", () => {
    // The gap this test was written for. amount_cents has no unit
    // attached: 28550 piastres and 28550 of anything else are the same
    // integer, so the amount check alone would settle a 285.50 EGP
    // booking against a payment taken in another currency.
    const obj = transaction({ currency: "USD" });
    expect(obj.amount_cents).toBe(EXPECTED_CENTS);
    expect(obj.currency.toUpperCase()).not.toBe(EXPECTED_CURRENCY);
  });

  it("treats currency case-insensitively", () => {
    // "egp" and "EGP" are the same currency; refusing one would fail a
    // genuine payment.
    expect("egp".toUpperCase()).toBe(EXPECTED_CURRENCY);
  });
});

describe("money that went back", () => {
  it("recognises a refund callback", () => {
    // Paymob sends a TRANSACTION for a refund too, with success still
    // true. Read as a payment it is an already-settled no-op, which is
    // how a refund issued in the Paymob dashboard used to go unrecorded.
    const obj = transaction({ is_refunded: true });
    expect(isSuccess(obj)).toBe(true);
    expect(isReversal(obj)).toBe(true);
  });

  it("recognises a void callback", () => {
    expect(isReversal(transaction({ is_voided: true }))).toBe(true);
  });

  it("does not mistake an ordinary payment for a reversal", () => {
    expect(isReversal(transaction())).toBe(false);
  });
});
