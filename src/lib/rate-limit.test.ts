import { describe, it, expect } from "vitest";
import { RULES, tooManyRequests, type Bucket } from "./rate-limit";

/**
 * The counting itself needs Postgres and is proved against the running
 * server instead — six requests to forgot-password return 200, 200,
 * 200, 200, 200, 429. What is tested here is everything a unit test can
 * reach: that the rules are sane, and that the refusal gives an
 * attacker nothing.
 */

describe("the rules", () => {
  it("limits every bucket to something a person would not hit", () => {
    for (const [name, rule] of Object.entries(RULES)) {
      expect(rule.limit, name).toBeGreaterThan(0);
      // A human mistyping a password three times must not be locked
      // out; a script trying thousands must be.
      expect(rule.limit, name).toBeGreaterThanOrEqual(5);
      expect(rule.limit, name).toBeLessThanOrEqual(60);
      expect(rule.windowSeconds, name).toBeGreaterThanOrEqual(60);
    }
  });

  it("makes brute forcing one account impractical", () => {
    // The number that matters, stated out loud: 8 attempts per 15
    // minutes is 768 a day against a single email. Slow enough that
    // guessing anything but a terrible password is hopeless, loose
    // enough that somebody who genuinely forgot theirs is not locked
    // out before they reach the reset link.
    //
    // Comparing this rate against signup's — which an earlier version
    // of this test did — says nothing: signup is slower because nobody
    // legitimately signs up five times an hour, not because it is more
    // dangerous.
    const perDay = (RULES.login.limit / RULES.login.windowSeconds) * 86_400;
    expect(perDay).toBeLessThan(1000);
    // And the per-window figure stays in the range a real person can
    // mistype without being stopped.
    expect(RULES.login.limit).toBeGreaterThanOrEqual(5);
    expect(RULES.login.limit).toBeLessThanOrEqual(10);
  });

  it("covers every endpoint the audit named", () => {
    const required: Bucket[] = [
      "login",
      "signup",
      "forgotPassword",
      "resetPassword",
      "verifyEmail",
      "phoneOtp",
    ];
    for (const bucket of required) expect(RULES[bucket]).toBeDefined();
  });
});

describe("the refusal", () => {
  it("answers 429 with Retry-After", () => {
    const res = tooManyRequests({ ok: false, remaining: 0, retryAfter: 900 });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("900");
  });

  it("is never cached", () => {
    // A cached 429 would lock somebody out past the window, and a
    // cached one from a CDN could lock out everybody behind it.
    const res = tooManyRequests({ ok: false, remaining: 0, retryAfter: 60 });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("says nothing about whether the account exists", async () => {
    // The whole point: if the message differed for a real address, the
    // limiter would be an account-enumeration oracle — a disclosure
    // rather than a defence.
    const res = tooManyRequests({ ok: false, remaining: 0, retryAfter: 60 });
    const body = (await res.json()) as { error: string };
    for (const leak of ["email", "account", "user", "exist", "found", "password"]) {
      expect(body.error.toLowerCase()).not.toContain(leak);
    }
    expect(body.error.length).toBeGreaterThan(0);
  });
});
