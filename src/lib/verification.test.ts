import { describe, it, expect } from "vitest";
import {
  generateEmailToken,
  generatePhoneCode,
  hashSecret,
  secretMatches,
  isExpired,
  cooledDown,
  normaliseEgyptianMobile,
  formatEgyptianMobile,
  qualifiesAsVerified,
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

describe("normaliseEgyptianMobile", () => {
  it("accepts the local 011 form", () => {
    expect(normaliseEgyptianMobile("01012345678")).toBe("201012345678");
  });

  it("accepts the international form", () => {
    expect(normaliseEgyptianMobile("+201012345678")).toBe("201012345678");
  });

  it("accepts a spaced and dashed number", () => {
    expect(normaliseEgyptianMobile("+20 101 234 5678")).toBe("201012345678");
    expect(normaliseEgyptianMobile("0101-234-5678")).toBe("201012345678");
  });

  it("accepts every valid Egyptian prefix", () => {
    for (const p of ["010", "011", "012", "015"]) {
      expect(normaliseEgyptianMobile(`${p}12345678`)).not.toBeNull();
    }
  });

  it("rejects an invalid prefix", () => {
    expect(normaliseEgyptianMobile("01312345678")).toBeNull();
  });

  it("rejects a landline", () => {
    expect(normaliseEgyptianMobile("0223456789")).toBeNull();
  });

  it("rejects a number that is too short or too long", () => {
    expect(normaliseEgyptianMobile("0101234567")).toBeNull();
    expect(normaliseEgyptianMobile("010123456789")).toBeNull();
  });

  it("rejects text", () => {
    expect(normaliseEgyptianMobile("not a number")).toBeNull();
  });
});

describe("formatEgyptianMobile", () => {
  it("renders a readable international form", () => {
    expect(formatEgyptianMobile("201012345678")).toBe("+20 10 1234 5678");
  });

  it("returns the input unchanged when it is not the expected length", () => {
    expect(formatEgyptianMobile("123")).toBe("123");
  });
});

describe("qualifiesAsVerified", () => {
  const full = {
    emailVerified: true,
    phoneVerified: true,
    hasServices: true,
    hasProfile: true,
  };

  it("grants the badge when everything is proven", () => {
    expect(qualifiesAsVerified(full)).toBe(true);
  });

  it("withholds it without a verified email", () => {
    expect(qualifiesAsVerified({ ...full, emailVerified: false })).toBe(false);
  });

  it("withholds it without a verified phone", () => {
    expect(qualifiesAsVerified({ ...full, phoneVerified: false })).toBe(false);
  });

  it("withholds it from a listing with no services", () => {
    expect(qualifiesAsVerified({ ...full, hasServices: false })).toBe(false);
  });

  it("withholds it from an incomplete profile", () => {
    expect(qualifiesAsVerified({ ...full, hasProfile: false })).toBe(false);
  });
});
