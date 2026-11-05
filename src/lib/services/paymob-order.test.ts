import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Paymob orders (final audit F-10, F-17).
 *
 * F-10: merchant_order_id was the bare booking id, and Paymob refuses an
 * order whose merchant_order_id it has already seen, so a second order for
 * the same booking (a fresh page after the first expired, the owner's
 * balance link after a deposit) always failed. The fake provider used in
 * QA does not enforce uniqueness, which is why nothing caught it.
 *
 * F-17: no call had a timeout, so a hung Paymob outlived the function.
 */

vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));

import {
  bookingIdFromMerchantOrderId,
  bookingMerchantOrderId,
  createPaymentSession,
  refundTransaction,
} from "./paymob";

type Call = { url: string; body: Record<string, unknown>; signal: unknown };
let calls: Call[] = [];
let nextOrderId = 100;

beforeEach(() => {
  calls = [];
  vi.stubEnv("PAYMOB_FAKE", "");
  vi.stubEnv("PAYMOB_API_KEY", "k");
  vi.stubEnv("PAYMOB_INTEGRATION_ID", "1");
  vi.stubEnv("PAYMOB_IFRAME_ID", "2");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), signal: init.signal });
    const seen = calls.filter((c) => c.url.endsWith("/ecommerce/orders")).map((c) => c.body.merchant_order_id);
    if (url.endsWith("/ecommerce/orders") && new Set(seen).size !== seen.length) {
      // What Paymob answers to a repeated merchant_order_id.
      return new Response(JSON.stringify({ message: "duplicate" }), { status: 422 });
    }
    const json = url.endsWith("/auth/tokens") ? { token: "t" } : url.endsWith("/ecommerce/orders") ? { id: nextOrderId++ } : url.endsWith("/payment_keys") ? { token: "pk" } : { id: 9, success: true };
    return new Response(JSON.stringify(json), { status: 200 });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const session = () =>
  createPaymentSession({ bookingId: "cmuzxwd9f000iw4ntz8pv3c51", amountCents: 5000, currency: "EGP", customerName: "A B", customerPhone: "+201000000000" });

describe("Paymob booking orders", () => {
  it("can open a second order for the same booking", async () => {
    const first = await session();
    const second = await session();
    expect(first.paymobOrderId).not.toBe(second.paymobOrderId);
    const ids = calls.filter((c) => c.url.endsWith("/ecommerce/orders")).map((c) => String(c.body.merchant_order_id));
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(bookingIdFromMerchantOrderId(id)).toBe("cmuzxwd9f000iw4ntz8pv3c51");
  });

  it("keeps the booking id recoverable, including from an old bare id", () => {
    expect(bookingIdFromMerchantOrderId(bookingMerchantOrderId("cabc", 1))).toBe("cabc");
    expect(bookingIdFromMerchantOrderId("cabc")).toBe("cabc");
  });

  it("gives every call a timeout", async () => {
    await session();
    await refundTransaction("123", 100);
    expect(calls.length).toBeGreaterThanOrEqual(5);
    for (const c of calls) expect(c.signal).toBeInstanceOf(AbortSignal);
  });

  it("reports a refund that timed out as uncertain, not as nothing happened", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/auth/tokens")) return new Response(JSON.stringify({ token: "t" }));
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }));
    const out = await refundTransaction("123", 100);
    expect(out).toMatchObject({ ok: false, uncertain: true });
  });
});
