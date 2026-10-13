import { describe, it, expect } from "vitest";
import { egyptianMobile, loginCode, emailLogin } from "./validation";

describe("egyptianMobile", () => {
  it.each(["01012345678", "+20 101 234 5678", "201512345678", "1112345678"])("accepts %s", (n) => {
    expect(egyptianMobile.safeParse(n).success).toBe(true);
  });

  it.each(["01312345678", "0101234567", "12345", ""])("refuses %s", (n) => {
    expect(egyptianMobile.safeParse(n).success).toBe(false);
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
