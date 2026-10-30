import { db } from "@/lib/db";
import { countedThisMonth } from "@/lib/bookings/create";
import {
  PLAN_FEATURES,
  allows,
  cheapestPlanWith,
  effectivePlanOf,
  limitOf,
  type Plan,
  type PlanFeature,
  type SubscriptionStatus,
} from "@/lib/plans";

/**
 * What this business may do right now, and how much of it is used.
 *
 * Built from lib/plans.ts — the one entitlement matrix the server
 * enforces — plus live counts from the same queries the enforcing
 * routes use (countedThisMonth for bookings, row counts for staff and
 * branches). The billing page, the app and any upgrade prompt read
 * this instead of keeping their own copy of the rules.
 *
 * Limits are numbers or null: JSON has no Infinity, and "no ceiling"
 * should not arrive as a huge number someone might print.
 */
export interface BusinessEntitlements {
  plan: Plan;
  effectivePlan: Plan;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  limits: { monthlyBookings: number | null; staffMembers: number | null; branches: number | null };
  usage: { bookingsThisMonth: number; staffMembers: number; branches: number };
  features: Record<PlanFeature, boolean>;
  /** The cheapest plan that unlocks each feature this business lacks. */
  upgrades: Partial<Record<PlanFeature, Plan | null>>;
}

const finite = (n: number) => (Number.isFinite(n) ? n : null);

/** Pure: the matrix read for a plan, without usage. Exported for tests. */
export function entitlementView(effective: Plan): Pick<BusinessEntitlements, "limits" | "features" | "upgrades"> {
  const keys = Object.keys(PLAN_FEATURES.FREE) as PlanFeature[];
  const features = Object.fromEntries(keys.map((k) => [k, allows(effective, k)])) as Record<PlanFeature, boolean>;
  const upgrades: Partial<Record<PlanFeature, Plan | null>> = {};
  for (const k of keys) if (!features[k]) upgrades[k] = cheapestPlanWith(k);
  return {
    limits: {
      monthlyBookings: finite(limitOf(effective, "monthlyBookings")),
      staffMembers: finite(limitOf(effective, "staffMembers")),
      branches: finite(limitOf(effective, "branches")),
    },
    features,
    upgrades,
  };
}

export async function loadEntitlements(businessId: string): Promise<BusinessEntitlements | null> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true, currentPeriodEnd: true },
  });
  if (!b) return null;
  const effective = effectivePlanOf({
    plan: b.plan as Plan,
    subscriptionStatus: b.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: b.trialEndsAt,
  });
  const [bookingsThisMonth, staffMembers, branches] = await Promise.all([
    db.booking.count({ where: countedThisMonth(businessId) }),
    db.staffMember.count({ where: { businessId } }),
    db.branch.count({ where: { businessId } }),
  ]);
  return {
    plan: b.plan as Plan,
    effectivePlan: effective,
    status: b.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: b.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: b.currentPeriodEnd?.toISOString() ?? null,
    usage: { bookingsThisMonth, staffMembers, branches },
    ...entitlementView(effective),
  };
}
