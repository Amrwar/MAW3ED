import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { authorizeCron } from "./cron-auth";

/**
 * The scheduled jobs are not harmless reads: one dispatches
 * notifications to real customers, the other moves subscriptions
 * between states. Both used to check the secret only `if (cronSecret)`,
 * so a deployment that had not set one left them open to anybody who
 * knew the path — verified against the production build before the fix,
 * where an unauthenticated GET returned 200.
 *
 * The case that matters most here is the third: no secret configured
 * must mean refusal, not permission.
 */

const SECRET = "a-secret-that-is-long-enough";
let original: string | undefined;

beforeEach(() => {
  original = process.env.CRON_SECRET;
});

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

function request(authorization?: string): Request {
  return new Request("https://example.test/api/cron/reminders", {
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("the cron guard", () => {
  it("accepts the configured secret", () => {
    process.env.CRON_SECRET = SECRET;
    expect(authorizeCron(request(`Bearer ${SECRET}`), "test").ok).toBe(true);
  });

  it("rejects a wrong secret", () => {
    process.env.CRON_SECRET = SECRET;
    const result = authorizeCron(request("Bearer wrong"), "test");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("refuses to run when no secret is configured", () => {
    // The regression this file exists for. Returning ok here would
    // reopen the endpoint to anybody who knows the path.
    delete process.env.CRON_SECRET;
    const result = authorizeCron(request("Bearer anything"), "test");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(503);
  });

  it("refuses an unauthenticated request when no secret is configured", () => {
    delete process.env.CRON_SECRET;
    expect(authorizeCron(request(), "test").ok).toBe(false);
  });

  it("rejects a missing header", () => {
    process.env.CRON_SECRET = SECRET;
    expect(authorizeCron(request(), "test").ok).toBe(false);
  });

  it("rejects the secret without the Bearer prefix", () => {
    process.env.CRON_SECRET = SECRET;
    expect(authorizeCron(request(SECRET), "test").ok).toBe(false);
  });

  it("rejects a secret of the wrong length without throwing", () => {
    // timingSafeEqual throws on mismatched lengths; the length check
    // has to come first or a short guess crashes the route instead of
    // being refused.
    process.env.CRON_SECRET = SECRET;
    expect(() => authorizeCron(request("Bearer x"), "test")).not.toThrow();
    expect(authorizeCron(request("Bearer x"), "test").ok).toBe(false);
  });

  it("never caches the refusal", () => {
    process.env.CRON_SECRET = SECRET;
    const result = authorizeCron(request("Bearer wrong"), "test");
    if (!result.ok) {
      expect(result.response.headers.get("Cache-Control")).toContain("no-store");
    }
  });
});
