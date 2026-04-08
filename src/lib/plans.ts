/**
 * Subscription plan definitions.
 *
 * FREE   — 30 bookings/month, no WhatsApp, no deposits, no analytics
 * GROWTH — unlimited bookings + WhatsApp + analytics
 * PRO    — everything + deposits/payments + custom branding
 */

export type Plan               = "FREE" | "GROWTH" | "PRO";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "INACTIVE";

// ─── Feature matrix ───────────────────────────────────────────────────────────

export const PLAN_FEATURES = {
  FREE: {
    monthlyBookings: 30,
    whatsapp:        false,
    deposits:        false,
    analytics:       false,
    customBranding:  false,
  },
  GROWTH: {
    monthlyBookings: Infinity,
    whatsapp:        true,
    deposits:        false,
    analytics:       true,
    customBranding:  false,
  },
  PRO: {
    monthlyBookings: Infinity,
    whatsapp:        true,
    deposits:        true,
    analytics:       true,
    customBranding:  true,
  },
} as const;

export type PlanFeature = keyof typeof PLAN_FEATURES.FREE;

// ─── Pricing (EGP / month) ────────────────────────────────────────────────────

export const PLAN_PRICES_EGP: Record<Plan, number> = {
  FREE:   0,
  GROWTH: 199,
  PRO:    399,
};

/** Prices in cents for Paymob (only paid plans) */
export const PLAN_PRICES_CENTS: Record<"GROWTH" | "PRO", number> = {
  GROWTH: 19900,
  PRO:    39900,
};

// ─── Arabic labels ────────────────────────────────────────────────────────────

export const PLAN_NAMES_AR: Record<Plan, string> = {
  FREE:   "المجاني",
  GROWTH: "النمو",
  PRO:    "الاحترافي",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the effective plan.
 * - TRIAL with valid trialEndsAt → GROWTH features
 * - INACTIVE → always FREE
 * - ACTIVE → plan as stored
 */
export function getEffectivePlan(
  plan:        Plan,
  status:      SubscriptionStatus,
  trialEndsAt: Date | null,
): Plan {
  if (status === "TRIAL" && trialEndsAt && trialEndsAt > new Date()) {
    return "GROWTH";
  }
  if (status === "INACTIVE") return "FREE";
  return plan;
}

export function canUseFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_FEATURES[plan][feature] as boolean;
}

export function getMonthlyBookingLimit(plan: Plan): number {
  return PLAN_FEATURES[plan].monthlyBookings;
}

/** Returns true if the business is on a paid active subscription */
export function isActivePaidPlan(plan: Plan, status: SubscriptionStatus): boolean {
  return status === "ACTIVE" && plan !== "FREE";
}
