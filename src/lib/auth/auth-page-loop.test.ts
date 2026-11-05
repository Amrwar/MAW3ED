import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => null }));

import { authConfig } from "@/auth.config";
import { homeFor } from "./signed-in-home";

/**
 * No redirect loop for a revoked session (final audit F-27). The proxy
 * decodes the cookie without the database; when it bounced a "signed-in"
 * /login to /dashboard, a revoked session went /dashboard → /login →
 * /dashboard until the browser gave up. The proxy now lets /login and
 * /signup through; their layouts decide with the database check.
 */

type Authorized = (p: { auth: unknown; request: { nextUrl: URL } }) => unknown;
const authorized = authConfig.callbacks!.authorized as unknown as Authorized;
const signedInCookie = { user: { id: "u1", businessId: "b1" } };

describe("the proxy and the sign-in pages", () => {
  for (const path of ["/login", "/signup", "/en/login"]) {
    it(`lets a cookie that looks signed in reach ${path}`, () => {
      expect(authorized({ auth: signedInCookie, request: { nextUrl: new URL(`http://x${path}`) } })).toBe(true);
    });
  }

  it("still sends a signed-out visitor of the dashboard to sign in", () => {
    expect(authorized({ auth: null, request: { nextUrl: new URL("http://x/dashboard") } })).toBe(false);
  });

  it("homes each kind of account where the proxy used to", () => {
    expect(homeFor({ businessId: "b" })).toBe("/dashboard");
    expect(homeFor({ adminRole: "ADMIN" })).toBe("/admin");
    expect(homeFor({})).toBe("/onboarding");
  });
});
