import { describe, it, expect } from "vitest";
import {
  generateEmailToken,
  generatePhoneCode,
  hashSecret,
  secretMatches,
  isExpired,
  cooledDown,
  PHONE_CODE_LENGTH,
} from "./verification";

describe("generateEmailToken", () => {
  it("is long enough not to be guessable", () => {
    expect(generateEmailToken()).toHaveLength(64);
  });

  it("differs every time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateEmailToken()));
    expect(seen.size).toBe(200);
  });
});

describe("generatePhoneCode", () => {
  it("is six digits", () => {
    expect(generatePhoneCode()).toMatch(/^\d{6}$/);
  });

  it("keeps leading zeros rather than shortening the code", () => {
    const codes = Array.from({ length: 4000 }, () => generatePhoneCode());
    expect(codes.every((c) => c.length === PHONE_CODE_LENGTH)).toBe(true);
  });

  it("spreads across the range", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generatePhoneCode()));
    // Collisions in 500 draws from a million are possible but a near-constant
    // generator would collapse this badly.
    expect(codes.size).toBeGreaterThan(450);
  });
});

describe("hashSecret / secretMatches", () => {
  it("never stores the secret itself", () => {
    const token = generateEmailToken();
    expect(hashSecret(token)).not.toBe(token);
  });

  it("is stable for the same input", () => {
    expect(hashSecret("abc")).toBe(hashSecret("abc"));
  });

  it("accepts the right secret", () => {
    const code = "123456";
    expect(secretMatches(code, hashSecret(code))).toBe(true);
  });

  it("rejects a wrong secret", () => {
    expect(secretMatches("000000", hashSecret("123456"))).toBe(false);
  });

  it("rejects a malformed stored hash rather than throwing", () => {
    expect(() => secretMatches("123456", "not-a-hash")).not.toThrow();
    expect(secretMatches("123456", "not-a-hash")).toBe(false);
  });
});

describe("isExpired", () => {
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);

  it("is false before the deadline", () => {
    expect(isExpired(new Date(now + 1000), now)).toBe(false);
  });

  it("is true at the deadline", () => {
    expect(isExpired(new Date(now), now)).toBe(true);
  });

  it("is true after the deadline", () => {
    expect(isExpired(new Date(now - 1), now)).toBe(true);
  });
});

describe("cooledDown", () => {
  const now = Date.UTC(2026, 9, 9, 12, 0, 0);

  it("blocks a resend inside the window", () => {
    expect(cooledDown(new Date(now - 30_000), 60_000, now)).toBe(false);
  });

  it("allows a resend once the window has passed", () => {
    expect(cooledDown(new Date(now - 61_000), 60_000, now)).toBe(true);
  });
});

// normaliseEgyptianMobile and formatEgyptianMobile became src/lib/phone.ts; their cases are in phone-cases.ts.
