import { describe, expect, it } from "vitest";
import { hashKey, keyMatches, newApiKey, prefixOf } from "./keys";
import { checkUrlShape, isPrivateAddress } from "./ssrf";
import { bookingEvent, MAX_ATTEMPTS, retryAt, signatureHeader, verifySignature } from "./webhooks";
import { seesBookings, seesReports } from "./visibility";
import { contractInForce } from "./auth";
import { isApiScope, isWebhookEvent } from "./scopes";
import { flagOn } from "@/lib/flags";
import { checkPayment } from "@/lib/payments/reconcile";
import { openWith, sealWith } from "@/lib/access/crypto";

describe("API keys", () => {
  it("are random, found by prefix, and matched by hash only", () => {
    const a = newApiKey();
    const b = newApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.key).toMatch(/^mw_[a-z0-9]{12}_[A-Za-z0-9_-]{32}$/);
    expect(prefixOf(a.key)).toBe(a.prefix);
    expect(a.hash).toBe(hashKey(a.key));
    expect(keyMatches(a.key, a.hash)).toBe(true);
    expect(keyMatches(b.key, a.hash)).toBe(false);
  });

  it("refuses anything that is not a well-formed key", () => {
    for (const k of ["", "mw_", "Bearer x", "mw_ABCDEFGHIJKL_" + "x".repeat(32), "mw_abcdefghijkl_short", "sk_live_123"]) expect(prefixOf(k)).toBeNull();
  });
});

describe("the SSRF guard", () => {
  it("knows private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.4", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("allows only public https on the default port, without credentials", () => {
    expect(checkUrlShape("https://hooks.example.com/maw3ed").ok).toBe(true);
    for (const [u, why] of [
      ["http://hooks.example.com/x", "https-only"],
      ["https://user:pw@hooks.example.com/x", "no-credentials"],
      ["https://hooks.example.com:8443/x", "default-port-only"],
      ["https://127.0.0.1/x", "private-address"],
      ["https://localhost/x", "private-address"],
      ["https://metadata.internal/x", "private-address"],
      ["not a url", "not-a-url"],
    ] as const) {
      const r = checkUrlShape(u);
      expect(r.ok, u).toBe(false);
      if (!r.ok) expect(r.why).toBe(why);
    }
  });
});

describe("webhook signing and retries", () => {
  const body = JSON.stringify({ id: "booking:x:1", type: "booking.created", data: {} });
  const now = 1_800_000_000;

  it("signs with the current secret, and the previous one during a rotation", () => {
    const h = signatureHeader(body, now, ["new-secret", "old-secret"]);
    expect(h.split(",").filter((p) => p.startsWith("v1=")).length).toBe(2);
    expect(verifySignature(body, h, "new-secret", now)).toBe(true);
    expect(verifySignature(body, h, "old-secret", now)).toBe(true);
    expect(verifySignature(body, h, "someone-else", now)).toBe(false);
    expect(verifySignature(body + " ", h, "new-secret", now)).toBe(false);
    expect(verifySignature(body, h, "new-secret", now + 301)).toBe(false); // replay window
  });

  it("backs off and stops after the last attempt", () => {
    const t = new Date(0);
    expect(retryAt(1, t)!.getTime()).toBe(60_000);
    expect(retryAt(2, t)!.getTime()).toBe(5 * 60_000);
    expect(retryAt(MAX_ATTEMPTS - 1, t)).not.toBeNull();
    expect(retryAt(MAX_ATTEMPTS, t)).toBeNull();
    expect(retryAt(99, t)).toBeNull();
  });

  it("names a booking change once: created if new since the last read, updated otherwise", () => {
    const created = new Date("2026-11-05T10:00:00Z");
    const before = new Date(created.getTime() - 1);
    expect(bookingEvent({ id: "b1", createdAt: created, updatedAt: created }, before)).toEqual({ eventId: `booking:b1:${created.getTime()}`, type: "booking.created" });
    // Changed again before anyone read it: still news of a new booking.
    expect(bookingEvent({ id: "b1", createdAt: created, updatedAt: new Date(created.getTime() + 500) }, before).type).toBe("booking.created");
    // Already read once (the cursor passed its creation): an update.
    expect(bookingEvent({ id: "b1", createdAt: created, updatedAt: new Date(created.getTime() + 500) }, created).type).toBe("booking.updated");
  });
});

describe("what an organization may see", () => {
  it("bookings only for owned or managed brands that granted RESERVATIONS", () => {
    expect(seesBookings({ relation: "OWNED", scopes: ["RESERVATIONS"] })).toBe(true);
    expect(seesBookings({ relation: "MANAGED", scopes: ["RESERVATIONS"] })).toBe(true);
    expect(seesBookings({ relation: "HOSTED", scopes: ["RESERVATIONS"] })).toBe(false);
    expect(seesBookings({ relation: "OWNED", scopes: ["REPORTS"] })).toBe(false);
    expect(seesReports({ scopes: ["REPORTS"] })).toEqual({ counts: true, money: false });
  });

  it("a contract is in force only between its dates", () => {
    const now = new Date("2026-11-05T00:00:00Z");
    expect(contractInForce(null, now)).toBe(false);
    expect(contractInForce({ startsAt: new Date("2026-11-01"), endsAt: null }, now)).toBe(true);
    expect(contractInForce({ startsAt: new Date("2026-12-01"), endsAt: null }, now)).toBe(false);
    expect(contractInForce({ startsAt: new Date("2026-10-01"), endsAt: new Date("2026-11-04") }, now)).toBe(false);
  });

  it("knows its scopes and events", () => {
    expect(isApiScope("bookings:read")).toBe(true);
    expect(isApiScope("bookings:write")).toBe(false);
    expect(isWebhookEvent("booking.updated")).toBe(true);
    expect(isWebhookEvent("customer.created")).toBe(false);
  });
});

describe("feature flags", () => {
  it("are on unless named off", () => {
    expect(flagOn("webhooks", undefined)).toBe(true);
    expect(flagOn("webhooks", "")).toBe(true);
    expect(flagOn("webhooks", "enterpriseApi, webhooks")).toBe(false);
    expect(flagOn("enterpriseApi", "webhooks")).toBe(true);
  });
});

describe("sealed secrets per purpose", () => {
  it("a webhook secret cannot be opened as a venue credential, and vice versa", () => {
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = prev || "test-secret-for-sealing-0123456789";
    const sealed = sealWith("webhook-secret", "whsec_abc")!;
    expect(openWith("webhook-secret", sealed)).toBe("whsec_abc");
    expect(openWith("venue-credential", sealed)).toBeNull();
    expect(openWith("pass-at-rest", sealed)).toBeNull();
    process.env.AUTH_SECRET = prev;
  });
});

describe("payment reconciliation", () => {
  const base: { id: string; status: string; amountCents: number; refundedCents: number; receiptNumber: string | null; refundsSucceededCents: number; bookingStatus: string | null; kind: string } = { id: "p", status: "SUCCEEDED", amountCents: 10_000, refundedCents: 0, receiptNumber: "MW-1", refundsSucceededCents: 0, bookingStatus: "CONFIRMED", kind: "BOOKING_DEPOSIT" };
  it("finds nothing wrong with a clean payment", () => {
    expect(checkPayment(base)).toEqual([]);
    expect(checkPayment({ ...base, status: "PARTIALLY_REFUNDED", refundedCents: 4_000, refundsSucceededCents: 4_000 })).toEqual([]);
    expect(checkPayment({ ...base, status: "REFUNDED", refundedCents: 10_000, refundsSucceededCents: 10_000 })).toEqual([]);
  });
  it("names each kind of discrepancy", () => {
    const kinds = (p: Partial<typeof base>) => checkPayment({ ...base, ...p }).map((d) => d.check).sort();
    expect(kinds({ status: "PARTIALLY_REFUNDED", refundedCents: 4_000, refundsSucceededCents: 3_000 })).toEqual(["refund-sum"]);
    expect(kinds({ status: "REFUNDED", refundedCents: 5_000, refundsSucceededCents: 5_000 })).toEqual(["status"]);
    expect(kinds({ refundedCents: 12_000, refundsSucceededCents: 12_000, status: "REFUNDED" })).toEqual(["over-refunded"]);
    expect(kinds({ receiptNumber: null })).toEqual(["no-receipt"]);
    expect(kinds({ bookingStatus: "PENDING_PAYMENT" })).toEqual(["held-but-paid"]);
  });
});
