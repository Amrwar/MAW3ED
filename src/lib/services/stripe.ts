import { createHmac, timingSafeEqual } from "crypto";
import { getIntegrations } from "@/lib/env";

/**
 * Stripe, for plan payments only (a business buying Pro or Premium).
 * Customer booking payments stay on Paymob, which takes Egyptian cards,
 * Meeza and wallets; Stripe is the owner's Canadian account.
 *
 * The REST API over fetch, like the Paymob integration — no SDK. One
 * Checkout Session per attempt (Stripe-hosted page), priced in EGP;
 * Stripe converts to the account's settlement currency. The webhook
 * (/api/webhooks/stripe) is the only thing that can activate a plan; the
 * return page only reads the database.
 *
 * Environment (both or neither):
 *   STRIPE_SECRET_KEY     — a restricted key (rk_…) with write access to
 *                           Checkout Sessions and Refunds, read access to
 *                           Payment Intents. A secret key (sk_…) works too.
 *   STRIPE_WEBHOOK_SECRET — the endpoint's signing secret (whsec_…).
 */

const API = "https://api.stripe.com/v1";
/**
 * Pinned on every request we send. Webhook payloads are rendered in the
 * webhook ENDPOINT's API version, so the endpoint must be created with this
 * same version (docs/payments-stripe.md); the handler reads only fields
 * that are stable across recent versions (id, payment_status, amount_total,
 * currency, payment_intent, metadata; charge amount_refunded).
 */
export const STRIPE_API_VERSION = "2026-09-30.endive";
/**
 * Sessions expire after an hour: well inside the two hours after which
 * an unanswered payment is reaped (lib/payments/reap.ts), so a session
 * can never be paid after its payment row was abandoned.
 */
export const SESSION_TTL_SECONDS = 60 * 60;

/** One definition of "configured": the integrations list (lib/env.ts). */
export function stripeEnabled(): boolean {
  return getIntegrations().stripe;
}

/** Stripe's form encoding, nested keys as a[b][c]. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function stripePost<T>(path: string, body: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  return stripeRequest<T>("POST", path, body, idempotencyKey);
}

async function stripeRequest<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": STRIPE_API_VERSION,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(method === "POST" && body ? { body: formEncode(body).join("&") } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string; code?: string } };
  if (!res.ok) {
    const e = new Error(`stripe ${path} ${res.status}: ${json.error?.message ?? "no message"}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }
  return json;
}

export interface PlanCheckout {
  url: string;
  sessionId: string;
}

/**
 * Open a Checkout Session for one plan payment. `paymentId` is the ledger
 * row opened before the call; it is the idempotency key (a double click
 * gets the same session) and travels in the metadata so the webhook can
 * find the row.
 */
export async function createPlanCheckout(params: {
  paymentId: string;
  businessId: string;
  amountCents: number;
  /** "Maw3ed Pro — 1 month" */
  description: string;
  ownerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  now?: Date;
}): Promise<PlanCheckout> {
  const now = params.now ?? new Date();
  const session = await stripePost<{ id: string; url: string }>(
    "/checkout/sessions",
    {
      mode: "payment",
      // EGP is a two-decimal currency: Stripe's minor unit is the piastre
      // the ledger already stores. No payment_method_types: the methods
      // are chosen in the Stripe Dashboard (dynamic payment methods).
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "egp",
            unit_amount: params.amountCents,
            product_data: { name: params.description },
          },
        },
      ],
      client_reference_id: params.paymentId,
      metadata: { paymentId: params.paymentId, businessId: params.businessId, kind: "SUBSCRIPTION" },
      payment_intent_data: { metadata: { paymentId: params.paymentId, businessId: params.businessId } },
      ...(params.ownerEmail ? { customer_email: params.ownerEmail } : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      expires_at: Math.floor(now.getTime() / 1000) + SESSION_TTL_SECONDS,
      locale: "auto",
      // Always EGP: with Adaptive Pricing a foreign card could be shown
      // and charged in its own currency, and the webhook — which checks
      // the session against the EGP ledger row — would refuse a payment
      // that was really made.
      adaptive_pricing: { enabled: false },
    },
    `maw3ed-plan-${params.paymentId}`,
  );
  if (!session.url || !session.id) throw new Error("stripe returned a session without a url");
  return { url: session.url, sessionId: session.id };
}

/**
 * A session the owner already opened, if it can still be paid: a second
 * click on "upgrade" returns to it rather than opening a second payable
 * checkout. Null when it is gone, paid or expired, or Stripe cannot say.
 */
export async function openCheckoutUrl(sessionId: string): Promise<string | null> {
  try {
    const s = await stripeRequest<{ status?: string; url?: string | null }>("GET", `/checkout/sessions/${encodeURIComponent(sessionId)}`);
    return s.status === "open" && s.url ? s.url : null;
  } catch {
    return null;
  }
}

/**
 * What Stripe says has been refunded on a payment, in the payment's minor
 * unit; null when it cannot be read. Used to resynchronise the ledger
 * after an admin refund Stripe refused, so a Dashboard refund landing in
 * between is not lost.
 */
export async function stripeRefundedCents(paymentIntentId: string): Promise<number | null> {
  try {
    const pi = await stripeRequest<{ latest_charge?: { amount_refunded?: number } | string | null }>(
      "GET",
      `/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`,
    );
    const charge = pi.latest_charge;
    return charge && typeof charge === "object" && typeof charge.amount_refunded === "number" ? charge.amount_refunded : null;
  } catch {
    return null;
  }
}

/**
 * Refund part or all of a plan payment. Same shape as the Paymob refund,
 * so the admin route can call either. `uncertain` when Stripe could not
 * be heard from: the reservation is kept and nobody should retry blind.
 */
export async function refundStripePayment(
  paymentIntentId: string,
  amountCents: number,
  refundKey: string,
): Promise<{ ok: boolean; providerRefundId?: string; error?: string; uncertain?: boolean }> {
  try {
    const refund = await stripePost<{ id: string; status: string; failure_reason?: string }>(
      "/refunds",
      { payment_intent: paymentIntentId, amount: amountCents, metadata: { refundKey } },
      `maw3ed-refund-${refundKey}`,
    );
    if (refund.status === "failed" || refund.status === "canceled") {
      return { ok: false, providerRefundId: refund.id, error: refund.failure_reason ?? refund.status };
    }
    // "succeeded", or "pending" — Stripe has accepted it.
    return { ok: true, providerRefundId: refund.id };
  } catch (e) {
    const status = (e as { status?: number }).status;
    // A 4xx is a refusal; anything else (network, 5xx, timeout) is unknown.
    if (status && status >= 400 && status < 500) return { ok: false, error: String((e as Error).message) };
    return { ok: false, uncertain: true, error: String((e as Error).message) };
  }
}

/** Five minutes: Stripe's own default tolerance against replayed deliveries. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Check a webhook's Stripe-Signature header against the raw body:
 * HMAC-SHA256 of "<t>.<body>" with the signing secret, compared in
 * constant time against every v1 signature (Stripe sends several while a
 * secret is being rolled), and a timestamp inside the tolerance.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined = process.env.STRIPE_WEBHOOK_SECRET,
  now: Date = new Date(),
): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const t = Number(parts.find(([k]) => k === "t")?.[1]);
  const sigs = parts.filter(([k, v]) => k === "v1" && /^[0-9a-f]{64}$/.test(v ?? "")).map(([, v]) => v);
  if (!Number.isFinite(t) || sigs.length === 0) return false;
  if (Math.abs(now.getTime() / 1000 - t) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest();
  return sigs.some((s) => {
    const given = Buffer.from(s, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** For tests and the local QA harness: a header Stripe would send. */
export function signStripePayload(rawBody: string, secret: string, at: Date = new Date()): string {
  const t = Math.floor(at.getTime() / 1000);
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex")}`;
}
