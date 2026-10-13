import { describe, it, expect } from "vitest";
import { readPhone, loginCode, emailLogin } from "./validation";
import { countryByIso, countryForDigits, EGYPT, flagOf, matchesCountry } from "./countries";

describe("readPhone", () => {
  const SA = countryByIso("SA")!;
  const IT = countryByIso("IT")!;
  const CA = countryByIso("CA")!;

  it.each([
    ["01012345678", "+201012345678"],
    ["010 1234 5678", "+201012345678"],
    ["1112345678", "+201112345678"],
    ["201512345678", "+201512345678"],
    ["+20 101 234 5678", "+201012345678"],
  ])("Egypt: %s → %s", (input, e164) => {
    expect(readPhone(input, EGYPT).e164).toBe(e164);
  });

  it.each(["01312345678", "0101234567", "0223456789", "12345", ""])("Egypt refuses %s", (input) => {
    expect(readPhone(input, EGYPT).e164).toBeNull();
  });

  it("drops the trunk 0 another country writes locally", () => {
    expect(readPhone("050 123 4567", SA).e164).toBe("+966501234567");
    expect(readPhone("501234567", SA).e164).toBe("+966501234567");
  });

  it("keeps Italy's leading 0", () => {
    expect(readPhone("06 1234 5678", IT).e164).toBe("+390612345678");
  });

  it("takes a pasted number with its own code, whatever was picked", () => {
    const r = readPhone("+966 50 123 4567", EGYPT);
    expect(r.e164).toBe("+966501234567");
    expect(r.country.iso).toBe("SA");
    expect(readPhone("0044 20 7946 0958", EGYPT).e164).toBe("+442079460958");
  });

  it("keeps the picked country among those sharing a code", () => {
    expect(readPhone("+1 416 555 0100", CA).country.iso).toBe("CA");
    expect(readPhone("+1 416 555 0100", EGYPT).country.iso).toBe("US");
  });

  it("refuses what is too short to be anyone's number", () => {
    expect(readPhone("123", SA).e164).toBeNull();
    expect(readPhone("+966", EGYPT).e164).toBeNull();
  });
});

describe("countries", () => {
  it("prefers the longest calling code", () => {
    expect(countryForDigits("18761234567")?.iso).toBe("JM");
    expect(countryForDigits("14155552671")?.iso).toBe("US");
  });

  it("draws flags from the ISO code", () => {
    expect(flagOf("EG")).toBe("🇪🇬");
  });

  it("searches by either name or by code", () => {
    const sa = countryByIso("SA")!;
    expect(matchesCountry(sa, "saudi")).toBe(true);
    expect(matchesCountry(sa, "السعودية")).toBe(true);
    expect(matchesCountry(sa, "+966")).toBe(true);
    expect(matchesCountry(sa, "egypt")).toBe(false);
  });
});

describe("loginCode", () => {
  it("wants six digits, ignoring spaces a paste brings", () => {
    expect(loginCode.safeParse("424 242").success).toBe(true);
    expect(loginCode.safeParse("42424").success).toBe(false);
  });
});

describe("emailLogin", () => {
  it("needs a real address and a password", () => {
    expect(emailLogin.safeParse({ email: "owner@qa.test", password: "x" }).success).toBe(true);
    expect(emailLogin.safeParse({ email: "owner", password: "x" }).success).toBe(false);
    expect(emailLogin.safeParse({ email: "owner@qa.test", password: "" }).success).toBe(false);
  });
});
