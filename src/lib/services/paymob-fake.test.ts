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
  const local = { PAYMOB_FAKE: "1", VERCEL: undefined, VERCEL_ENV: undefined, PAYMOB_FAKE_BASE_URL: "http://localhost:3101", NEXT_PUBLIC_SITE_URL: undefined };

  it("is off unless explicitly turned on", () => {
    setEnv({ ...local, PAYMOB_FAKE: undefined });
    expect(fakePaymobEnabled()).toBe(false);
  });

  it("can never run on Vercel, whatever the flag says", () => {
    setEnv({ ...local, VERCEL_ENV: "production" });
    expect(fakePaymobEnabled()).toBe(false);
    setEnv({ ...local, VERCEL_ENV: "preview" });
    expect(fakePaymobEnabled()).toBe(false);
    setEnv({ ...local, VERCEL: "1" });
    expect(fakePaymobEnabled()).toBe(false);
  });

  it("can never serve its page from a public host", () => {
    setEnv({ ...local, PAYMOB_FAKE_BASE_URL: undefined, NEXT_PUBLIC_SITE_URL: "https://www.maw3ed.net" });
    expect(fakePaymobEnabled()).toBe(false);
    setEnv({ ...local, PAYMOB_FAKE_BASE_URL: "https://maw3ed.net" });
    expect(fakePaymobEnabled()).toBe(false);
  });

  it("runs for a local production build, which is what the end-to-end script tests", () => {
    setEnv({ ...local, NODE_ENV: "production" });
    expect(fakePaymobEnabled()).toBe(true);
    setEnv({ ...local, PAYMOB_FAKE_BASE_URL: undefined, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" });
    expect(fakePaymobEnabled()).toBe(true);
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
