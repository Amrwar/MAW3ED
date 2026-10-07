import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_FEATURES,
  FEATURE_ORDER,
  allows,
  limitOf,
  wouldExceed,
  cheapestPlanWith,
  planAtLeast,
  isUpgrade,
  isDowngrade,
  getEffectivePlan,
  effectivePlanOf,
  businessAllows,
  featureRows,
  type PlanFeature,
} from "./plans";

describe("the matrix itself", () => {
  it("covers every entitlement for every plan", () => {
    for (const plan of PLANS) {
      for (const key of FEATURE_ORDER) {
        expect(PLAN_FEATURES[plan][key], `${plan}.${key}`).toBeDefined();
      }
    }
  });

  it("lists every entitlement in FEATURE_ORDER", () => {
    // Or a feature exists that no page can show.
    const keys = Object.keys(PLAN_FEATURES.FREE) as PlanFeature[];
    expect([...FEATURE_ORDER].sort()).toEqual([...keys].sort());
  });

  it("never takes something away as the plan goes up", () => {
    // A higher tier that loses a feature is a pricing bug, and the kind
    // nobody notices until a customer who paid more complains.
    for (let i = 1; i < PLANS.length; i++) {
      const lower = PLANS[i - 1];
      const higher = PLANS[i];
      for (const key of FEATURE_ORDER) {
        expect(limitOf(higher, key), `${key}: ${higher} < ${lower}`).toBeGreaterThanOrEqual(
          limitOf(lower, key),
        );
      }
    }
  });
});

describe("allows / limitOf", () => {
  it("reads a boolean entitlement", () => {
    expect(allows("FREE", "analytics")).toBe(false);
    expect(allows("PRO", "analytics")).toBe(true);
  });

  it("treats a ceiling of zero as a no", () => {
    expect(limitOf("FREE", "staffMembers")).toBe(0);
    expect(allows("FREE", "staffMembers")).toBe(false);
    expect(allows("PRO", "staffMembers")).toBe(true);
  });

  it("gives Infinity for an uncapped entitlement", () => {
    expect(limitOf("PRO", "monthlyBookings")).toBe(Infinity);
    expect(limitOf("PREMIUM", "staffMembers")).toBe(Infinity);
  });
});

describe("wouldExceed", () => {
  it("stops the first staff member on a plan with none", () => {
    expect(wouldExceed("FREE", "staffMembers", 0)).toBe(true);
  });

  it("allows up to the ceiling and not past it", () => {
    expect(wouldExceed("PRO", "staffMembers", 9)).toBe(false);
    expect(wouldExceed("PRO", "staffMembers", 10)).toBe(true);
  });

  it("never stops an uncapped plan", () => {
    expect(wouldExceed("PREMIUM", "staffMembers", 10_000)).toBe(false);
  });

  it("only bites on a second branch, since one is not multi-branch", () => {
    expect(wouldExceed("FREE", "branches", 0)).toBe(false);
    expect(wouldExceed("FREE", "branches", 1)).toBe(true);
    expect(wouldExceed("PREMIUM", "branches", 1)).toBe(false);
  });

  it("is asked about adding, so being over a lowered ceiling is not an error", () => {
    // A business that drops from PREMIUM to PRO with 40 staff keeps
    // them; it just cannot add a 41st.
    expect(wouldExceed("PRO", "staffMembers", 40)).toBe(true);
  });
});

describe("cheapestPlanWith", () => {
  it("names the plan to upgrade to", () => {
    expect(cheapestPlanWith("staffMembers")).toBe("PRO");
    expect(cheapestPlanWith("deposits")).toBe("PRO");
    expect(cheapestPlanWith("api")).toBe("PREMIUM");
    expect(cheapestPlanWith("branches")).toBe("PREMIUM");
  });
});

describe("rank", () => {
  it("orders the plans", () => {
    expect(isUpgrade("FREE", "PRO")).toBe(true);
    expect(isUpgrade("PRO", "PREMIUM")).toBe(true);
    expect(isUpgrade("PREMIUM", "PRO")).toBe(false);
    expect(isDowngrade("PREMIUM", "PRO")).toBe(true);
    expect(isUpgrade("PRO", "PRO")).toBe(false);
    expect(isDowngrade("PRO", "PRO")).toBe(false);
  });

  it("answers at-least inclusively", () => {
    expect(planAtLeast("PRO", "PRO")).toBe(true);
    expect(planAtLeast("PREMIUM", "PRO")).toBe(true);
    expect(planAtLeast("FREE", "PRO")).toBe(false);
  });
});

describe("effective plan", () => {
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  it("gives a live trial PRO", () => {
    expect(getEffectivePlan("FREE", "TRIAL", future)).toBe("PRO");
  });

  it("drops an expired trial back", () => {
    expect(getEffectivePlan("FREE", "TRIAL", past)).toBe("FREE");
  });

  it("drops a lapsed subscription to FREE without forgetting the plan", () => {
    expect(getEffectivePlan("PREMIUM", "INACTIVE", null)).toBe("FREE");
  });

  it("reads a business row", () => {
    const business = { plan: "PRO" as const, subscriptionStatus: "ACTIVE" as const, trialEndsAt: null };
    expect(effectivePlanOf(business)).toBe("PRO");
    expect(businessAllows(business, "deposits")).toBe(true);
    expect(businessAllows(business, "api")).toBe(false);
  });

  it("refuses a lapsed business the features it used to have", () => {
    const lapsed = { plan: "PREMIUM" as const, subscriptionStatus: "INACTIVE" as const, trialEndsAt: null };
    expect(businessAllows(lapsed, "analytics")).toBe(false);
    expect(businessAllows(lapsed, "deposits")).toBe(false);
    expect(businessAllows(lapsed, "api")).toBe(false);
  });

  it("keeps reminding customers whatever happens to the subscription", () => {
    // Reminders are on every plan, so a lapsed or free business still
    // tells its customers when their appointment is. The person who
    // gets stood up by a forgotten reminder did not choose the plan.
    const lapsed = { plan: "PREMIUM" as const, subscriptionStatus: "INACTIVE" as const, trialEndsAt: null };
    const free = { plan: "FREE" as const, subscriptionStatus: "ACTIVE" as const, trialEndsAt: null };
    expect(businessAllows(lapsed, "reminders")).toBe(true);
    expect(businessAllows(free, "reminders")).toBe(true);
    expect(PLANS.every((p) => allows(p, "reminders"))).toBe(true);
  });
});

describe("featureRows", () => {
  it("counts rather than ticking a counted entitlement", () => {
    const pro = featureRows("PRO");
    expect(pro.find((r) => r.key === "monthlyBookings")?.ar).toBe("حجوزات غير محدودة");
    expect(pro.find((r) => r.key === "staffMembers")?.ar).toBe("حتى 10 أفراد");
    expect(featureRows("FREE").find((r) => r.key === "monthlyBookings")?.ar).toBe("30 حجز شهريًا");
  });

  it("names a zero ceiling plainly instead of 'up to 0'", () => {
    const row = featureRows("FREE").find((r) => r.key === "staffMembers")!;
    expect(row.ar).toBe("فريق العمل");
    expect(row.enabled).toBe(false);
  });

  it("does not call a single branch multi-branch", () => {
    expect(featureRows("FREE").find((r) => r.key === "branches")?.enabled).toBe(false);
    expect(featureRows("PRO").find((r) => r.key === "branches")?.enabled).toBe(false);
    expect(featureRows("PREMIUM").find((r) => r.key === "branches")?.enabled).toBe(true);
  });

  it("gives every row both languages", () => {
    for (const plan of PLANS) {
      for (const row of featureRows(plan)) {
        expect(row.ar.length, `${plan}.${row.key}.ar`).toBeGreaterThan(0);
        expect(row.en.length, `${plan}.${row.key}.en`).toBeGreaterThan(0);
      }
    }
  });
});
