import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { phoneSignInRefused, phoneSignInRefusedFor } from "./phone-signin-policy";

const user = (o: Partial<Parameters<typeof phoneSignInRefused>[0]> = {}) => ({
  isAdmin: false, adminRole: null, business: null, hasPassword: false, oauthCount: 0, ...o,
});

describe("phoneSignInRefused", () => {
  it("lets a customer sign in with a phone code", () => {
    expect(phoneSignInRefused(user({ hasPassword: true }))).toBe(false);
  });

  it("refuses an owner who has a password: a recycled number must not open the dashboard", () => {
    expect(phoneSignInRefused(user({ business: { id: "b1" }, hasPassword: true }))).toBe(true);
  });

  it("refuses an owner who signs in with Google", () => {
    expect(phoneSignInRefused(user({ business: { id: "b1" }, oauthCount: 1 }))).toBe(true);
  });

  it("refuses an admin, by role or by the old flag", () => {
    expect(phoneSignInRefused(user({ adminRole: "SUPPORT", hasPassword: true }))).toBe(true);
    expect(phoneSignInRefused(user({ isAdmin: true, oauthCount: 1 }))).toBe(true);
  });

  it("keeps phone sign-in for an owner with no other way in, rather than locking them out", () => {
    expect(phoneSignInRefused(user({ business: { id: "b1" } }))).toBe(false);
  });
});

describe("phoneSignInRefusedFor", () => {
  beforeEach(() => findUnique.mockReset());

  it("is false for a number nobody holds yet", async () => {
    findUnique.mockResolvedValue(null);
    expect(await phoneSignInRefusedFor("201000000000")).toBe(false);
  });

  it("reads the holder without writing, and refuses an owner with a password", async () => {
    findUnique.mockResolvedValue({
      isAdmin: false, adminRole: null, password: "hash", business: { id: "b1" }, _count: { accounts: 0 },
    });
    expect(await phoneSignInRefusedFor("201000000000")).toBe(true);
    expect(findUnique.mock.calls[0][0].where).toEqual({ phone: "201000000000" });
  });
});
