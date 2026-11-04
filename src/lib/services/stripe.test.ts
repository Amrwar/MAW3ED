import { describe, expect, it } from "vitest";
import { formEncode, signStripePayload, verifyStripeSignature, SIGNATURE_TOLERANCE_SECONDS } from "./stripe";

const SECRET = "whsec_test_secret";
const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

describe("verifyStripeSignature", () => {
  it("accepts what Stripe would send", () => {
    const now = new Date();
    expect(verifyStripeSignature(body, signStripePayload(body, SECRET, now), SECRET, now)).toBe(true);
  });
  it("accepts when any of several v1 signatures matches (secret rolling)", () => {
    const now = new Date();
    const good = signStripePayload(body, SECRET, now);
    const t = good.split(",")[0];
    const header = `${t},v1=${"0".repeat(64)},${good.split(",")[1]}`;
    expect(verifyStripeSignature(body, header, SECRET, now)).toBe(true);
  });
  it("refuses a changed body, a wrong secret, a missing header", () => {
    const now = new Date();
    const h = signStripePayload(body, SECRET, now);
    expect(verifyStripeSignature(body.replace("evt_1", "evt_2"), h, SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, h, "whsec_other", now)).toBe(false);
    expect(verifyStripeSignature(body, null, SECRET, now)).toBe(false);
    expect(verifyStripeSignature(body, h, undefined, now)).toBe(false);
  });
  it("refuses a replay outside five minutes, either way", () => {
    const signedAt = new Date("2026-11-05T10:00:00Z");
    const h = signStripePayload(body, SECRET, signedAt);
    const late = new Date(signedAt.getTime() + (SIGNATURE_TOLERANCE_SECONDS + 1) * 1000);
    const early = new Date(signedAt.getTime() - (SIGNATURE_TOLERANCE_SECONDS + 1) * 1000);
    expect(verifyStripeSignature(body, h, SECRET, late)).toBe(false);
    expect(verifyStripeSignature(body, h, SECRET, early)).toBe(false);
  });
  it("refuses malformed signatures without throwing", () => {
    const now = new Date();
    const t = Math.floor(now.getTime() / 1000);
    for (const h of [`t=${t}`, `t=${t},v1=zz`, `t=abc,v1=${"a".repeat(64)}`, "garbage", `v0=${"a".repeat(64)}`]) {
      expect(verifyStripeSignature(body, h, SECRET, now)).toBe(false);
    }
  });
});

describe("formEncode", () => {
  it("encodes nested objects and arrays the way Stripe reads them", () => {
    const s = formEncode({
      mode: "payment",
      line_items: [{ quantity: 1, price_data: { currency: "egp", unit_amount: 29900, product_data: { name: "Maw3ed Pro — 1 month" } } }],
      metadata: { paymentId: "p1" },
      skip: undefined,
    }).join("&");
    expect(decodeURIComponent(s)).toBe(
      "mode=payment&line_items[0][quantity]=1&line_items[0][price_data][currency]=egp&line_items[0][price_data][unit_amount]=29900&line_items[0][price_data][product_data][name]=Maw3ed Pro — 1 month&metadata[paymentId]=p1",
    );
  });
});
