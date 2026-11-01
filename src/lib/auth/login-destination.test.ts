import { describe, expect, it } from "vitest";
import { loginDestination } from "./login-destination";

/**
 * Phase 23 post-audit: the login page read only `callbackUrl` and only
 * into /dashboard, so a member of staff who scanned a booking QR and
 * signed in lost the code, and venue security (no business) landed on
 * onboarding instead of their desk.
 */

const O = "https://www.maw3ed.net";
const owner = { businessId: "b1", adminRole: null };
const security = { businessId: null, adminRole: null };

describe("loginDestination", () => {
  it("returns staff to the booking QR they scanned", () => {
    expect(loginDestination("?next=/c/abc123", O, owner)).toBe("/c/abc123");
    expect(loginDestination("?next=/c/abc123", O, security)).toBe("/c/abc123");
  });

  it("returns venue security and group managers (no business) to their pages", () => {
    expect(loginDestination("?next=/venue-admin/v1/access", O, security)).toBe("/venue-admin/v1/access");
    expect(loginDestination("?next=/org-admin/o1", O, security)).toBe("/org-admin/o1");
    expect(loginDestination("?next=/en/venue-admin", O, security)).toBe("/en/venue-admin");
  });

  it("keeps the dashboard callback for owners, as before", () => {
    expect(loginDestination(`?callbackUrl=${encodeURIComponent(`${O}/dashboard/bookings?day=1`)}`, O, owner)).toBe("/dashboard/bookings?day=1");
    expect(loginDestination("?callbackUrl=/dashboard/check-in", O, owner)).toBe("/dashboard/check-in");
  });

  it("does not send an account without a business into the dashboard", () => {
    expect(loginDestination("?callbackUrl=/dashboard", O, security)).toBe("/onboarding");
    expect(loginDestination("?callbackUrl=/dashboard", O, { businessId: null, adminRole: "SUPER" })).toBe("/admin");
  });

  it("refuses other sites and other places", () => {
    for (const bad of [
      "https://evil.example/venue-admin",
      "//evil.example/venue-admin",
      "/\\evil.example/venue-admin",
      "javascript:alert(1)",
      "/account",
      "/admin/users",
      "/c/a/b",
      "/venue-administrator",
      "/venue-admin/../admin/users",
      "/venue-admin/%2e%2e/admin",
      "/c/../admin/users",
    ]) {
      expect(loginDestination(`?next=${encodeURIComponent(bad)}`, O, owner), bad).toBe("/dashboard");
    }
  });

  it("falls back to the account's home with nothing to return to", () => {
    expect(loginDestination("", O, owner)).toBe("/dashboard");
    expect(loginDestination("", O, security)).toBe("/onboarding");
    expect(loginDestination("", O, undefined)).toBe("/onboarding");
  });
});
