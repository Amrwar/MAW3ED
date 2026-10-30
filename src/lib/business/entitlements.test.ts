import { describe, it, expect, vi } from "vitest";

// entitlements.ts imports the db for its loader; only the pure view is tested here.
vi.mock("@/lib/db", () => ({ db: {} }));

import { entitlementView } from "./entitlements";
import { PLAN_FEATURES, limitOf } from "@/lib/plans";

describe("entitlementView", () => {
  it("reads the same matrix the server enforces, with no Infinity in the JSON", () => {
    const free = entitlementView("FREE");
    expect(free.limits).toEqual({ monthlyBookings: PLAN_FEATURES.FREE.monthlyBookings, staffMembers: 0, branches: 1 });
    expect(free.features).toMatchObject({ deposits: false, whatsapp: false, analytics: false, reminders: true, branches: false });
    expect(free.upgrades).toMatchObject({ deposits: "PRO", analytics: "PRO", staffMembers: "PRO", branches: "PREMIUM" });

    const premium = entitlementView("PREMIUM");
    expect(premium.limits).toEqual({ monthlyBookings: null, staffMembers: null, branches: null });
    expect(premium.upgrades).toEqual({});
    expect(JSON.stringify(premium)).not.toMatch(/Infinity|null:/);
  });

  it("agrees with limitOf for every plan", () => {
    for (const plan of ["FREE", "PRO", "PREMIUM"] as const) {
      const v = entitlementView(plan);
      expect(v.limits.staffMembers ?? Infinity).toBe(limitOf(plan, "staffMembers"));
      expect(v.limits.branches ?? Infinity).toBe(limitOf(plan, "branches"));
    }
  });
});
