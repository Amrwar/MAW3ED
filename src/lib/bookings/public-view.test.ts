import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { summariseDeliveries } from "./public-view";
import { readFileSync } from "fs";
import { join } from "path";

describe("what the app is told about notifications", () => {
  it("keeps one line per channel, preferring a delivery to a failure to a skip", () => {
    expect(
      summariseDeliveries([
        { channel: "WHATSAPP", status: "FAILED" },
        { channel: "WHATSAPP", status: "SENT" },
        { channel: "EMAIL", status: "SKIPPED" },
        { channel: "EMAIL", status: "FAILED" },
        { channel: "PUSH", status: "SKIPPED" },
      ]),
    ).toEqual([
      { channel: "WHATSAPP", status: "SENT" },
      { channel: "EMAIL", status: "FAILED" },
      { channel: "PUSH", status: "SKIPPED" },
    ]);
  });
});

describe("the booking route's refusals", () => {
  const source = readFileSync(join(process.cwd(), "src/app/api/public/[slug]/bookings/route.ts"), "utf8");

  it("carries a code beside every error, so the app can act on it in either language", () => {
    // Each call, up to the end of its statement.
    const calls = source.split("return err(").slice(1).map((rest) => rest.slice(0, rest.indexOf(");")));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toMatch(/\{\s*code: "/);
  });

  it("names the race the app recovers from", () => {
    expect(source).toContain('code: "slot-taken"');
    expect(source).toContain('code: "payment-unavailable"');
  });
});

describe("the booking status endpoint", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/bookings/public-view.ts"), "utf8");

  it("reports only deliveries addressed to the customer, never the business's", () => {
    expect(source).toContain('dedupeKey: { contains: ":customer:" }');
  });

  it("never returns the customer's phone, the access token or the payment provider ids", () => {
    const select = source.slice(source.indexOf("findUnique"), source.indexOf("if (!b) return null"));
    for (const field of ["customerPhone", "accessToken", "paymobOrderId", "paymobTransactionId", "providerOrderId", "idempotencyKey"]) {
      expect(select).not.toContain(`${field}: true`);
    }
  });
});
