import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/api", () => ({ err: () => new Response(null), requireSession: async () => null }));

import { allowedScopes, checkScopes, DELEGATION_SCOPES } from "./scopes";
import { actionsFor, SCOPE_ACTIONS } from "./delegation";
import { actingRedirect } from "./acting-paths";
import { todaysHours } from "./hours";
import { inviteBusinessSchema, joinRequestSchema, businessResponseSchema } from "./rules";
import { can, permissionsOf, type BusinessAction } from "@/lib/business-access";
import { buildNav } from "@/lib/dashboard/nav";

describe("what each relationship may carry", () => {
  it("hosted carries nothing, finance only to owners, a branch only reservations", () => {
    expect(allowedScopes("HOSTED", null)).toEqual([]);
    expect(allowedScopes("OWNED", null)).toEqual([...DELEGATION_SCOPES]);
    expect(allowedScopes("MANAGED", null)).not.toContain("FINANCE");
    expect(allowedScopes("MANAGED", "branch-1")).toEqual(["RESERVATIONS"]);
    expect(allowedScopes("OWNED", "branch-1")).toEqual(["RESERVATIONS"]);
    // Legacy labels are not relationship types and carry nothing.
    expect(allowedScopes("TENANT", null)).toEqual([]);
  });
  it("checkScopes refuses what is not allowed and orders what is", () => {
    expect(checkScopes("HOSTED", null, ["RESERVATIONS"])).toEqual({ ok: false, refused: ["RESERVATIONS"] });
    expect(checkScopes("MANAGED", null, ["FINANCE", "RESERVATIONS"])).toEqual({ ok: false, refused: ["FINANCE"] });
    expect(checkScopes("OWNED", null, ["REPORTS", "RESERVATIONS", "REPORTS"])).toEqual({ ok: true, scopes: ["RESERVATIONS", "REPORTS"] });
  });
});

describe("a delegate's powers are exactly its scopes", () => {
  const delegate = (scopes: (typeof DELEGATION_SCOPES)[number][]) => ({ role: "DELEGATE" as const, delegation: { actions: actionsFor(scopes) } });

  it("reservations runs the diary, never money, settings or who signs in", () => {
    const d = delegate(["RESERVATIONS"]);
    for (const a of ["bookings.read", "bookings.confirm", "bookings.cancel", "bookings.reschedule", "bookings.create"] as const) expect(can(d, a)).toBe(true);
    for (const a of ["finance.read", "reports.read", "customers.read", "services.manage", "staff.manageAccess", "profile.manage"] as const) expect(can(d, a)).toBe(false);
  });
  it("no scope, or everything, still never reaches sign-in access", () => {
    expect(permissionsOf(delegate([]))).toEqual([]);
    const all = delegate([...DELEGATION_SCOPES]);
    expect(can(all, "staff.manageAccess")).toBe(false);
    expect(can(all, "finance.read")).toBe(true);
  });
  it("no scope maps to the owner-only action of managing sign-in access", () => {
    for (const actions of Object.values(SCOPE_ACTIONS)) expect(actions).not.toContain("staff.manageAccess" as BusinessAction);
  });
  it("owner and staff roles are unchanged by delegation", () => {
    expect(can({ role: "OWNER" }, "finance.read")).toBe(true);
    expect(can({ role: "MANAGER" }, "services.manage")).toBe(false);
    expect(can({ role: "PROVIDER" }, "bookings.cancel")).toBe(false);
  });
});

describe("pages that exist while acting for an organization", () => {
  it("lets the delegate pages through and turns everything else back", () => {
    for (const p of ["/dashboard", "/dashboard/bookings", "/dashboard/bookings/today", "/dashboard/calendar", "/dashboard/customers/abc", "/dashboard/services", "/dashboard/staff", "/dashboard/settings", "/dashboard/reports/revenue", "/en/dashboard/services"]) {
      expect(actingRedirect(p, true), p).toBeNull();
    }
    for (const [p, to] of [["/dashboard/billing", "/dashboard"], ["/dashboard/offers", "/dashboard"], ["/dashboard/setup", "/dashboard"], ["/dashboard/branches", "/dashboard"], ["/en/dashboard/import", "/en/dashboard"], ["/dashboard/organizations", "/dashboard"]]) {
      expect(actingRedirect(p, true), p).toBe(to);
    }
  });
  it("does nothing without an acting context, or outside the dashboard", () => {
    expect(actingRedirect("/dashboard/billing", false)).toBeNull();
    expect(actingRedirect("/groups/x", true)).toBeNull();
    expect(actingRedirect("/dashboardx", true)).toBeNull();
  });
});

describe("a delegate's navigation", () => {
  const labels = new Proxy({}, { get: (_t, k) => String(k) }) as Record<string, string>;
  const hrefs = (perms: string[]) =>
    buildNav({ labels, pendingCount: 0, resourceWord: "r", hasResources: true, hasBranches: true, delegatePermissions: perms })
      .flatMap((s) => s.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]));

  it("shows only what the scopes open, and the way back to the organization", () => {
    const r = hrefs(actionsFor(["RESERVATIONS"]));
    expect(r).toEqual(expect.arrayContaining(["/dashboard", "/dashboard/bookings", "/dashboard/calendar", "/org-admin"]));
    for (const hidden of ["/dashboard/billing", "/dashboard/settings", "/dashboard/services", "/dashboard/customers", "/dashboard/reports/revenue", "/dashboard/offers"]) expect(r).not.toContain(hidden);
    const reports = hrefs(actionsFor(["REPORTS"]));
    expect(reports).toContain("/dashboard/reports/bookings");
    expect(reports).not.toContain("/dashboard/reports/revenue");
    expect(hrefs(actionsFor(["REPORTS", "FINANCE"]))).toContain("/dashboard/reports/revenue");
  });
});

describe("relationship input", () => {
  it("maps the legacy labels older clients send to their meaning", () => {
    expect(inviteBusinessSchema.parse({ businessSlug: "abc", relation: "TENANT" }).relation).toBe("HOSTED");
    expect(inviteBusinessSchema.parse({ businessSlug: "abc", relation: "PARTNER" }).relation).toBe("HOSTED");
    expect(inviteBusinessSchema.parse({ businessSlug: "abc", relation: "FRANCHISE" }).relation).toBe("MANAGED");
    expect(inviteBusinessSchema.parse({ businessSlug: "abc" }).relation).toBe("HOSTED");
    expect(inviteBusinessSchema.safeParse({ businessSlug: "abc", relation: "LANDLORD" }).success).toBe(false);
  });
  it("a grant's end must be in the future; null means until revoked", () => {
    expect(businessResponseSchema.safeParse({ action: "grant", scopes: [], expiresAt: "2020-01-01T00:00:00Z" }).success).toBe(false);
    expect(businessResponseSchema.safeParse({ action: "grant", scopes: ["RESERVATIONS"], expiresAt: null }).success).toBe(true);
    expect(joinRequestSchema.safeParse({ organizationId: "o", scopes: ["NOT_A_SCOPE"] }).success).toBe(false);
  });
});

describe("a venue's hours today", () => {
  const week = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "22:00", isClosed: d === 5 }));
  it("reads the Cairo day's rule", () => {
    expect(todaysHours(week, "2026-10-31")).toEqual({ closed: false, open: "10:00", close: "22:00" }); // Saturday
    expect(todaysHours(week, "2026-10-30")).toEqual({ closed: true, open: "10:00", close: "22:00" }); // Friday
    expect(todaysHours([], "2026-10-31")).toBeNull();
  });
});
