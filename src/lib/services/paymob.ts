/**
 * Paymob Accept payment integration.
 *
 * Flow:
 *  1. authenticate()     → auth token (valid ~1 hour)
 *  2. createOrder()      → Paymob order ID
 *  3. getPaymentKey()    → payment token for hosted iframe
 *  4. Redirect customer  → https://accept.paymob.com/api/acceptance/iframes/{id}?payment_token=...
 *  5. Webhook fires      → verifyWebhookHmac() then update booking status
 *
 * Required env vars:
 *   PAYMOB_API_KEY        — from Paymob dashboard → Settings → API Keys
 *   PAYMOB_INTEGRATION_ID — card/wallet integration ID from Integrations tab
 *   PAYMOB_IFRAME_ID      — iframe ID from iFrames tab
 *   PAYMOB_HMAC_SECRET    — HMAC secret from Settings → Security Settings
 */

import { createHmac, timingSafeEqual } from "crypto";
import { log } from "@/lib/logger";

const PAYMOB_BASE = "https://accept.paymob.com/api";

// ─── Response shape types ─────────────────────────────────────────────────────

interface PaymobAuthResponse    { token: string }
interface PaymobOrderResponse   { id: number }
interface PaymobPaymentKeyResponse { token: string }

/** Shape of the transaction object inside a Paymob webhook body */
export interface PaymobTransactionObj {
  id:                    number;
  pending:               boolean;
  amount_cents:          number;
  success:               boolean;
  is_auth:               boolean;
  is_capture:            boolean;
  is_standalone_payment: boolean;
  is_voided:             boolean;
  is_refunded:           boolean;
  is_3d_secure:          boolean;
  error_occured:         boolean;
  has_parent_transaction: boolean;
  integration_id:        number;
  owner:                 number | string;
  currency:              string;
  created_at:            string;
  order: {
    id:               number | string;
    merchant_order_id?: string; // our booking ID
  };
  source_data: {
    pan:      string;
    sub_type: string;
    type:     string;
  };
}

// ─── Step 1: Authenticate ─────────────────────────────────────────────────────

async function authenticate(): Promise<string> {
  const res = await fetch(`${PAYMOB_BASE}/auth/tokens`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ api_key: process.env.PAYMOB_API_KEY }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob auth failed ${res.status}: ${text}`);
  }
  const data: PaymobAuthResponse = await res.json();
  return data.token;
}

// ─── Step 2: Create order ─────────────────────────────────────────────────────

async function createOrder(
  authToken:      string,
  amountCents:    number,
  currency:       string,
  bookingId:      string,  // stored as merchant_order_id for webhook correlation
): Promise<number> {
  const res = await fetch(`${PAYMOB_BASE}/ecommerce/orders`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token:        authToken,
      delivery_needed:   false,
      amount_cents:      amountCents,
      currency,
      merchant_order_id: bookingId,
      items:             [],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob order creation failed ${res.status}: ${text}`);
  }
  const data: PaymobOrderResponse = await res.json();
  return data.id;
}

// ─── Step 3: Payment key ──────────────────────────────────────────────────────

async function getPaymentKey(
  authToken:    string,
  amountCents:  number,
  orderId:      number,
  currency:     string,
  billing: {
    firstName:  string;
    lastName:   string;
    phone:      string;
    email?:     string;
  },
): Promise<string> {
  const integrationId = parseInt(process.env.PAYMOB_INTEGRATION_ID ?? "0", 10);

  const res = await fetch(`${PAYMOB_BASE}/acceptance/payment_keys`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_token:     authToken,
      amount_cents:   amountCents,
      expiration:     3600,
      order_id:       orderId,
      billing_data: {
        apartment:       "NA",
        email:           billing.email ?? "NA",
        floor:           "NA",
        first_name:      billing.firstName,
        street:          "NA",
        building:        "NA",
        phone_number:    billing.phone,
        shipping_method: "NA",
        postal_code:     "NA",
        city:            "NA",
        country:         "EG",
        last_name:       billing.lastName || "NA",
        state:           "NA",
      },
      currency,
      integration_id: integrationId,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paymob payment key failed ${res.status}: ${text}`);
  }
  const data: PaymobPaymentKeyResponse = await res.json();
  return data.token;
}

// ─── Public: Create a full payment session ────────────────────────────────────

export interface PaymentSession {
  paymentUrl:    string;
  paymobOrderId: string;
}

export async function createPaymentSession(params: {
  bookingId:      string;
  amountCents:    number;
  currency:       string;
  customerName:   string;
  customerPhone:  string;
  customerEmail?: string;
}): Promise<PaymentSession> {
  const { bookingId, amountCents, currency, customerName, customerPhone, customerEmail } = params;

  const nameParts = customerName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName  = nameParts.slice(1).join(" ") || "NA";

  const authToken  = await authenticate();
  const orderId    = await createOrder(authToken, amountCents, currency, bookingId);
  const paymentKey = await getPaymentKey(authToken, amountCents, orderId, currency, {
    firstName,
    lastName,
    phone: customerPhone,
    email: customerEmail,
  });

  const iframeId  = process.env.PAYMOB_IFRAME_ID ?? "";
  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return { paymentUrl, paymobOrderId: String(orderId) };
}

// ─── Public: Verify webhook HMAC ──────────────────────────────────────────────

/**
 * Verify the HMAC signature of a Paymob transaction webhook.
 *
 * Paymob concatenates these fields in alphabetical order and signs with
 * HMAC-SHA512. Field order is mandated by Paymob docs and MUST NOT change.
 */
export function verifyWebhookHmac(
  obj:  PaymobTransactionObj,
  hmac: string,
): boolean {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret) {
    log.error("[paymob] PAYMOB_HMAC_SECRET not set — rejecting webhook");
    return false;
  }

  // Fields in the exact order specified by Paymob
  const data = [
    String(obj.amount_cents),
    String(obj.created_at),
    String(obj.currency),
    String(obj.error_occured),
    String(obj.has_parent_transaction),
    String(obj.id),
    String(obj.integration_id),
    String(obj.is_3d_secure),
    String(obj.is_auth),
    String(obj.is_capture),
    String(obj.is_refunded),
    String(obj.is_standalone_payment),
    String(obj.is_voided),
    String(obj.order.id),
    String(obj.owner),
    String(obj.pending),
    String(obj.source_data.pan),
    String(obj.source_data.sub_type),
    String(obj.source_data.type),
    String(obj.success),
  ].join("");

  const expected = createHmac("sha512", secret).update(data).digest("hex");

  // Constant time. A plain === returns as soon as two bytes differ, and
  // the time it took is a measurement of how much of the signature was
  // right — enough, over many tries, to forge one.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hmac ?? "", "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Public: Refund ───────────────────────────────────────────────────────────

export interface RefundOutcome {
  ok: boolean;
  providerRefundId?: string;
  error?: string;
}

/**
 * Send money back for a transaction Paymob has already captured.
 *
 * Paymob takes the amount in piastres and refuses anything above what
 * was taken, so a partial refund is just a smaller number. The caller
 * has already checked that this much is left to refund; this only
 * reports what Paymob said.
 */
export async function refundTransaction(
  transactionId: string,
  amountCents: number,
): Promise<RefundOutcome> {
  try {
    const authToken = await authenticate();

    const res = await fetch(`${PAYMOB_BASE}/acceptance/void_refund/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: authToken,
        transaction_id: transactionId,
        amount_cents: amountCents,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      log.error("[paymob] refund refused", { transactionId, status: res.status, text });
      return { ok: false, error: `paymob ${res.status}: ${text.slice(0, 300)}` };
    }

    let parsed: { id?: number | string; success?: boolean } = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Paymob answered 200 with something unparseable. The money has
      // most likely moved, so this is not reported as a failure — it is
      // reported as a refund with no id, which a human has to reconcile.
      log.warn("[paymob] refund returned unparseable body", { transactionId, text });
    }

    if (parsed.success === false) {
      return { ok: false, error: "paymob reported the refund as unsuccessful" };
    }

    return { ok: true, providerRefundId: parsed.id != null ? String(parsed.id) : undefined };
  } catch (e) {
    log.error("[paymob] refund threw", e);
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

/**
 * Calculate deposit amount in cents from service price and percentage.
 * Rounds up to the nearest whole cent.
 */
export function calcDepositCents(priceEGP: number, depositPercent: number): number {
  return Math.ceil(priceEGP * (depositPercent / 100) * 100);
}

// ─── Public: Create a subscription payment session ────────────────────────────

/**
 * Create a Paymob payment session for a subscription upgrade.
 * merchant_order_id is set to "sub_{businessId}_{plan}" for webhook identification.
 */
export async function createSubscriptionPaymentSession(params: {
  businessId:   string;
  plan:         "PRO" | "PREMIUM";
  amountCents:  number;
  ownerName:    string;
  ownerPhone:   string;
  ownerEmail?:  string;
}): Promise<PaymentSession> {
  const { businessId, plan, amountCents, ownerName, ownerPhone, ownerEmail } = params;

  const merchantOrderId = `sub_${businessId}_${plan}_${Date.now()}`;
  const nameParts = ownerName.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName  = nameParts.slice(1).join(" ") || "NA";

  const authToken  = await authenticate();
  const orderId    = await createOrder(authToken, amountCents, "EGP", merchantOrderId);
  const paymentKey = await getPaymentKey(authToken, amountCents, orderId, "EGP", {
    firstName,
    lastName,
    phone: ownerPhone || "01000000000",
    email: ownerEmail,
  });

  const iframeId   = process.env.PAYMOB_IFRAME_ID ?? "";
  const paymentUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

  return { paymentUrl, paymobOrderId: String(orderId) };
}
