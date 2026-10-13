import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { fakePaymobEnabled, signedCallback } from "./paymob-fake";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

function setEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("the fake Paymob checkout", () => {
  it("is off unless explicitly turned on", () => {
    setEnv({ PAYMOB_FAKE: undefined, NODE_ENV: "development", VERCEL_ENV: undefined });
    expect(fakePaymobEnabled()).toBe(false);
  });

  it("can never run in production, whatever the flag says", () => {
    setEnv({ PAYMOB_FAKE: "1", NODE_ENV: "production", VERCEL_ENV: undefined });
    expect(fakePaymobEnabled()).toBe(false);
    setEnv({ PAYMOB_FAKE: "1", NODE_ENV: "development", VERCEL_ENV: "production" });
    expect(fakePaymobEnabled()).toBe(false);
  });

  it("signs callbacks the way the real webhook check expects", () => {
    setEnv({ PAYMOB_HMAC_SECRET: "test-secret" });
    const { obj, hmac } = signedCallback("9123456789012", 46250, "EGP", true);
    const fields = [
      obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction, obj.id,
      obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded, obj.is_standalone_payment,
      obj.is_voided, obj.order.id, obj.owner, obj.pending, obj.source_data.pan, obj.source_data.sub_type,
      obj.source_data.type, obj.success,
    ].map(String).join("");
    expect(hmac).toBe(createHmac("sha512", "test-secret").update(fields).digest("hex"));
    // The order id survives as a number — no precision lost.
    expect(String(obj.order.id)).toBe("9123456789012");
  });

  it("is checked by every entry point", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/dev/paymob/checkout/route.ts"), "utf8");
    expect(route.match(/if \(!fakePaymobEnabled\(\)\) return notFound\(\);/g)?.length).toBe(2);
    const paymob = readFileSync(join(process.cwd(), "src/lib/services/paymob.ts"), "utf8");
    expect(paymob).toContain("if (fakePaymobEnabled()) return createFakeSession(");
  });
});

describe("the webhook's booking rules", () => {
  const source = readFileSync(join(process.cwd(), "src/app/api/webhooks/paymob/route.ts"), "utf8");

  it("confirms only a booking that was waiting on the money", () => {
    expect(source).toContain('if (booking.status !== "PENDING_PAYMENT") return;');
  });

  it("revives a released booking outside the settlement, so a taken slot cannot lose the payment", () => {
    const fn = source.slice(source.indexOf("async function handleBookingSuccess("));
    const settled = fn.indexOf('if (!changed) return "already-settled";');
    const revive = fn.indexOf('where: { id: payment.bookingId, status: "FAILED_PAYMENT" }');
    expect(settled).toBeGreaterThan(-1);
    // After the settlement has committed, never inside it.
    expect(revive).toBeGreaterThan(settled);
    expect(source).toContain('action: "payment.paid_after_release"');
  });
});
