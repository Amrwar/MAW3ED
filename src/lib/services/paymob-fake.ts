import { createHmac, randomInt } from "crypto";
import type { PaymobTransactionObj } from "./paymob";

/**
 * A stand-in for Paymob's hosted checkout, for local QA only.
 *
 * Without real Paymob credentials a deposit booking cannot get past
 * "payment couldn't start", so the whole booking → payment → webhook →
 * confirmation → notification path could not be exercised. This replaces
 * exactly one thing — the page the customer pays on — and nothing else:
 * the order and payment ledger rows, the webhook route, its HMAC check,
 * its idempotency and its booking updates are the real ones. The fake
 * page sends the same signed TRANSACTION callback Paymob sends.
 *
 * It can never run in production: it needs PAYMOB_FAKE=1 AND a
 * non-production NODE_ENV AND no production Vercel environment, and
 * every entry point checks fakePaymobEnabled() itself.
 */
export function fakePaymobEnabled(): boolean {
  return (
    process.env.PAYMOB_FAKE === "1" &&
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

/** Where the fake checkout is served — the API's own origin as the phone reaches it. */
function base(): string {
  return (process.env.PAYMOB_FAKE_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function createFakeSession(p: { bookingId: string; amountCents: number; currency: string }) {
  if (!fakePaymobEnabled()) throw new Error("fake Paymob is disabled");
  // Numeric like Paymob's, and marked so a fake order is recognisable in the ledger.
  // 13 digits: a safe JavaScript integer, since the callback carries it as a number.
  const paymobOrderId = `9${String(Date.now()).slice(-9)}${randomInt(100, 999)}`;
  const q = new URLSearchParams({ order: paymobOrderId, booking: p.bookingId, amount: String(p.amountCents), currency: p.currency });
  return { paymentUrl: `${base()}/api/dev/paymob/checkout?${q}`, paymobOrderId };
}

/** The callback Paymob would send, signed with the real secret so the real check passes. */
export function signedCallback(orderId: string, amountCents: number, currency: string, success: boolean) {
  const obj: PaymobTransactionObj = {
    id: Number(`7${String(Date.now()).slice(-9)}${randomInt(10, 99)}`),
    pending: false,
    amount_cents: amountCents,
    success,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 0,
    has_parent_transaction: false,
    error_occured: false,
    owner: 0,
    currency,
    created_at: new Date().toISOString(),
    order: { id: Number(orderId) },
    source_data: { pan: "4242", type: "card", sub_type: "Visa" },
    data: success ? {} : { message: "Declined (fake checkout)", txn_response_code: "DECLINED" },
  };

  const fields = [
    obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction, obj.id,
    obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
    obj.is_voided, obj.order.id, obj.owner, obj.pending, obj.source_data.pan, obj.source_data.sub_type,
    obj.source_data.type, obj.success,
  ].map(String).join("");
  const hmac = createHmac("sha512", process.env.PAYMOB_HMAC_SECRET ?? "").update(fields).digest("hex");
  return { type: "TRANSACTION", obj, hmac };
}
