import { describe, it, expect } from "vitest";
import { phoneSignInRefused } from "./phone-signin-policy";

const user = (o: Partial<Parameters<typeof phoneSignInRefused>[0]> = {}) => ({
  isAdmin: false, adminRole: null, business: null, ...o,
});

describe("phoneSignInRefused", () => {
  it("lets a customer sign in with a phone code", () => {
    expect(phoneSignInRefused(user())).toBe(false);
  });

  it("refuses a business owner: a recycled number must not open the dashboard", () => {
    expect(phoneSignInRefused(user({ business: { id: "b1" } }))).toBe(true);
  });

  it("refuses an admin, by role or by the old flag", () => {
    expect(phoneSignInRefused(user({ adminRole: "SUPPORT" }))).toBe(true);
    expect(phoneSignInRefused(user({ isAdmin: true }))).toBe(true);
  });
});
