import { describe, expect, it } from "vitest";
import { hasSessionCookie, isCrossSiteMutation } from "./origin";

const base = { method: "POST", pathname: "/api/account/profile", host: "www.maw3ed.net", hasSessionCookie: true };

describe("cross-site mutation check", () => {
  it("refuses a POST from another origin carrying our session cookie", () => {
    expect(isCrossSiteMutation({ ...base, origin: "https://evil.example" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, method: "delete", origin: "https://maw3ed.net.evil.example" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, origin: "null" })).toBe(true);
    expect(isCrossSiteMutation({ ...base, origin: "not a url" })).toBe(true);
  });

  it("allows the site's own pages", () => {
    expect(isCrossSiteMutation({ ...base, origin: "https://www.maw3ed.net" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, origin: "https://WWW.maw3ed.net" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, host: "localhost:3101", origin: "http://localhost:3101" })).toBe(false);
  });

  it("ignores reads, non-API paths, and requests without a cookie or an Origin", () => {
    expect(isCrossSiteMutation({ ...base, method: "GET", origin: "https://evil.example" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, pathname: "/account", origin: "https://evil.example" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, hasSessionCookie: false, origin: "https://evil.example" })).toBe(false);
    expect(isCrossSiteMutation({ ...base, origin: null })).toBe(false);
  });

  it("leaves routes with their own authentication alone", () => {
    for (const pathname of ["/api/webhooks/paymob", "/api/cron/reminders", "/api/auth/callback/credentials", "/api/auth/signout", "/api/auth/csrf", "/api/auth/mobile/refresh", "/api/dev/paymob/checkout"]) {
      expect(isCrossSiteMutation({ ...base, pathname, origin: "https://evil.example" })).toBe(false);
    }
  });

  it("still checks the project's own routes under /api/auth/", () => {
    for (const pathname of ["/api/auth/verify-email/send", "/api/auth/signup", "/api/auth/reset-password"]) {
      expect(isCrossSiteMutation({ ...base, pathname, origin: "https://evil.example" })).toBe(true);
    }
  });

  it("recognises the session cookie under both names", () => {
    expect(hasSessionCookie("authjs.session-token=abc")).toBe(true);
    expect(hasSessionCookie("lang=ar; __Secure-authjs.session-token=abc")).toBe(true);
    expect(hasSessionCookie("authjs.csrf-token=abc")).toBe(false);
    expect(hasSessionCookie(null)).toBe(false);
  });
});
