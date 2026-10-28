/**
 * Subscription entitlements — the single source of truth for what a
 * plan may do.
 *
 * Nothing outside this file is allowed to know that PREMIUM is the top
 * tier, that FREE stops at thirty bookings, or that deposits need a
 * paid plan. Code asks `allows(plan, "deposits")` or
 * `limitOf(plan, "staffMembers")` and gets an answer; when a limit
 * moves, it moves here and everywhere agrees at once.
 *
 * That was not true before. `canUseDeposits={effectivePlan === "PREMIUM"}`
 * sat six lines from a correct canUseFeature() call in the same
 * component, and the upgrade route decided what counted as a downgrade
 * by comparing plan names. Both are now rank and matrix questions.
 *
 *   FREE     a working booking page: profile, services, scheduling,
 *            thirty bookings a month, and reminders to the customer
 *   PRO      the business tools: unlimited bookings, staff, WhatsApp,
 *            analytics, and taking money from customers
 *   PREMIUM  the group tools: branches, advanced analytics, marketing,
 *            API access, priority support, own branding
 */

import { arCount } from "@/lib/fmt";

export type Plan = "FREE" | "PRO" | "PREMIUM";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "INACTIVE";

/** Every plan, in widening order. */
export const PLANS = ["FREE", "PRO", "PREMIUM"] as const;

/** The plans that are actually bought. */
export const PAID_PLANS = ["PRO", "PREMIUM"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export function isPaidPlan(plan: Plan): plan is PaidPlan {
  return plan !== "FREE";
}

/**
 * Rank, so "is this an upgrade?" is arithmetic rather than a list of
 * plan names that has to be rewritten every time a tier is added.
 */
export const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  PRO: 1,
  PREMIUM: 2,
};

/** True when `plan` is at least as good as `minimum`. */
export function planAtLeast(plan: Plan, minimum: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

/** True when moving from `from` to `to` is a step up. */
export function isUpgrade(from: Plan, to: Plan): boolean {
  return PLAN_RANK[to] > PLAN_RANK[from];
}

/** True when moving from `from` to `to` is a step down. */
export function isDowngrade(from: Plan, to: Plan): boolean {
  return PLAN_RANK[to] < PLAN_RANK[from];
}

// ─── The matrix ───────────────────────────────────────────────────────────────

/**
 * A numeric entitlement is a ceiling; `Infinity` means no ceiling and
 * `0` means the feature is not available at all. A boolean one is a
 * plain yes or no. `allows()` reads both without the caller caring
 * which kind it is.
 */
export interface Entitlements {
  /** Bookings the business may take in a calendar month. */
  monthlyBookings: number;
  /** Staff members that can be scheduled against. 0 = no staff feature. */
  staffMembers: number;
  /** Branches. 1 means a single location, i.e. no multi-branch. */
  branches: number;
  /**
   * Automatic reminders to the customer before their appointment.
   *
   * On every plan, free included. It is the customer who is reminded,
   * not the business, and a missed appointment because nobody was told
   * costs the person who booked it as much as the person who lost the
   * slot. The entitlement stays in the matrix so it can be moved if
   * that view ever changes, but it is granted to everyone.
   */
  reminders: boolean;
  /** WhatsApp as a notification channel. */
  whatsapp: boolean;
  /** Taking money from customers: deposits, balances, full payment. */
  deposits: boolean;
  /** The dashboard analytics page. */
  analytics: boolean;
  /** Cohorts, retention and revenue breakdowns on top of the basics. */
  advancedAnalytics: boolean;
  /** Campaign and customer-marketing tools. */
  marketing: boolean;
  /** Programmatic access. */
  api: boolean;
  /** Support queue priority. */
  prioritySupport: boolean;
  /** Hide the Maw3ed mark from the public booking page. */
  customBranding: boolean;
}

export const PLAN_FEATURES: Record<Plan, Entitlements> = {
  FREE: {
    monthlyBookings: 30,
    staffMembers: 0,
    branches: 1,
    reminders: true,
    whatsapp: false,
    deposits: false,
    analytics: false,
    advancedAnalytics: false,
    marketing: false,
    api: false,
    prioritySupport: false,
    customBranding: false,
  },
  PRO: {
    monthlyBookings: Infinity,
    staffMembers: 10,
    branches: 1,
    reminders: true,
    whatsapp: true,
    deposits: true,
    analytics: true,
    advancedAnalytics: false,
    marketing: false,
    api: false,
    prioritySupport: false,
    customBranding: false,
  },
  PREMIUM: {
    monthlyBookings: Infinity,
    staffMembers: Infinity,
    branches: Infinity,
    reminders: true,
    whatsapp: true,
    deposits: true,
    analytics: true,
    advancedAnalytics: true,
    marketing: true,
    api: true,
    prioritySupport: true,
    customBranding: true,
  },
};

export type PlanFeature = keyof Entitlements;

// ─── Reading the matrix ───────────────────────────────────────────────────────

/** The raw entitlement, whichever kind it is. */
export function entitlement<K extends PlanFeature>(plan: Plan, key: K): Entitlements[K] {
  return PLAN_FEATURES[plan][key];
}

/**
 * The value at which a counted entitlement is not really a feature.
 *
 * Zero for most of them: no staff is no staff feature. One for
 * branches, because every business has a location and only the second
 * one is "multiple branches" — without this, allows(FREE, "branches")
 * answers true and an upgrade prompt points at the plan they are
 * already on.
 */
const BASELINE: Partial<Record<PlanFeature, number>> = { branches: 1 };

/**
 * Is this feature available at all?
 *
 * A ceiling at the baseline is as much a "no" as `false` is, so callers
 * that only want to know whether to show a button do not have to care
 * whether the entitlement is counted or where its baseline sits.
 */
export function allows(plan: Plan, key: PlanFeature): boolean {
  const value = PLAN_FEATURES[plan][key];
  return typeof value === "number" ? value > (BASELINE[key] ?? 0) : value;
}

/** The ceiling for a counted entitlement. */
export function limitOf(plan: Plan, key: PlanFeature): number {
  const value = PLAN_FEATURES[plan][key];
  return typeof value === "number" ? value : value ? Infinity : 0;
}

/**
 * Would taking one more put the business over its ceiling?
 *
 * Asked before creating, never after: a plan change that lowers a
 * ceiling must not delete staff somebody already has. Existing rows
 * over the line are left alone and simply cannot be added to.
 */
export function wouldExceed(plan: Plan, key: PlanFeature, current: number): boolean {
  return current + 1 > limitOf(plan, key);
}

/** The cheapest plan that has this feature, for an upgrade prompt. */
export function cheapestPlanWith(key: PlanFeature): Plan | null {
  return PLANS.find((p) => allows(p, key)) ?? null;
}

// ─── Effective plan ───────────────────────────────────────────────────────────

/**
 * What the business may actually do right now, as opposed to what it
 * has bought.
 *
 * A trial behaves like PRO until it runs out. A lapsed subscription
 * falls back to FREE without the stored plan being rewritten, so the
 * owner can renew into the plan they had rather than having to pick it
 * again.
 */
export function getEffectivePlan(
  plan: Plan,
  status: SubscriptionStatus,
  trialEndsAt: Date | null,
): Plan {
  if (status === "TRIAL" && trialEndsAt && trialEndsAt > new Date()) return "PRO";
  if (status === "INACTIVE") return "FREE";
  return plan;
}

/**
 * The same question, asked of a business row.
 *
 * Every caller was spelling out the same three arguments in the same
 * order, which is three chances to pass trialEndsAt where
 * subscriptionStatus goes.
 */
export function effectivePlanOf(business: {
  plan: Plan;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: Date | null;
}): Plan {
  return getEffectivePlan(business.plan, business.subscriptionStatus, business.trialEndsAt);
}

/** What this business is allowed to do, by entitlement name. */
export function businessAllows(
  business: { plan: Plan; subscriptionStatus: SubscriptionStatus; trialEndsAt: Date | null },
  key: PlanFeature,
): boolean {
  return allows(effectivePlanOf(business), key);
}

/** Kept for the call sites that read better this way. */
export function canUseFeature(plan: Plan, feature: PlanFeature): boolean {
  return allows(plan, feature);
}

export function getMonthlyBookingLimit(plan: Plan): number {
  return limitOf(plan, "monthlyBookings");
}

/** On a paid plan, and paid up. */
export function isActivePaidPlan(plan: Plan, status: SubscriptionStatus): boolean {
  return status === "ACTIVE" && isPaidPlan(plan);
}

// ─── Pricing (EGP / month) ────────────────────────────────────────────────────

export const PLAN_PRICES_EGP: Record<Plan, number> = {
  FREE: 0,
  PRO: 299,
  PREMIUM: 499,
};

/** The same prices in piastres, which is what Paymob charges in. */
export const PLAN_PRICES_CENTS: Record<PaidPlan, number> = {
  PRO: PLAN_PRICES_EGP.PRO * 100,
  PREMIUM: PLAN_PRICES_EGP.PREMIUM * 100,
};

// ─── Names ────────────────────────────────────────────────────────────────────

export const PLAN_NAMES_AR: Record<Plan, string> = {
  FREE: "المجاني",
  PRO: "الاحترافي",
  PREMIUM: "المميز",
};

export const PLAN_NAMES_EN: Record<Plan, string> = {
  FREE: "Free",
  PRO: "Pro",
  PREMIUM: "Premium",
};

// ─── Presenting the matrix ────────────────────────────────────────────────────

/**
 * How each row of the matrix reads on a page.
 *
 * Both the pricing page and the dashboard's subscription panel used to
 * keep their own label maps and their own rendering rule, and that rule
 * — `typeof value === "boolean" ? value : true` — called every counted
 * entitlement available, so a plan with zero staff would have shown
 * "staff" ticked. The formatter lives here now and they share it.
 */
export interface FeatureRow {
  key: PlanFeature;
  /** Whether the plan has it, for the tick or the dash. */
  enabled: boolean;
  /** What to write on the row, already counting. */
  ar: string;
  en: string;
}

const LABELS: Record<PlanFeature, { ar: string; en: string }> = {
  monthlyBookings: { ar: "حجوزات شهرية", en: "Monthly bookings" },
  staffMembers: { ar: "فريق العمل", en: "Staff members" },
  branches: { ar: "فروع متعددة", en: "Multiple branches" },
  reminders: { ar: "تذكيرات تلقائية للعملاء", en: "Automatic customer reminders" },
  whatsapp: { ar: "إشعارات واتساب", en: "WhatsApp notifications" },
  deposits: { ar: "استلام مدفوعات وعربون", en: "Take payments and deposits" },
  analytics: { ar: "لوحة الإحصائيات", en: "Analytics dashboard" },
  advancedAnalytics: { ar: "تحليلات متقدمة", en: "Advanced analytics" },
  marketing: { ar: "أدوات تسويق", en: "Marketing tools" },
  api: { ar: "وصول للـ API", en: "API access" },
  prioritySupport: { ar: "دعم بأولوية", en: "Priority support" },
  customBranding: { ar: "إخفاء شعار موعد", en: "Remove Maw3ed branding" },
};

/** A row's name, for the label column of a comparison. */
export function featureLabel(key: PlanFeature, lang: "ar" | "en"): string {
  return LABELS[key][lang];
}

/** The order the rows read best in. */
export const FEATURE_ORDER: PlanFeature[] = [
  "monthlyBookings",
  "staffMembers",
  "branches",
  "reminders",
  "whatsapp",
  "deposits",
  "analytics",
  "advancedAnalytics",
  "marketing",
  "api",
  "prioritySupport",
  "customBranding",
];

function countLabel(key: PlanFeature, value: number, lang: "ar" | "en"): string {
  const unlimited = lang === "ar" ? "غير محدود" : "Unlimited";
  const label = LABELS[key][lang];

  // A ceiling of none is not "up to 0 staff"; it is the feature, named
  // plainly, so the row can be struck through like any other it lacks.
  if (value === 0) return label;

  if (key === "monthlyBookings") {
    if (value === Infinity) return lang === "ar" ? "حجوزات غير محدودة" : "Unlimited bookings";
    return lang === "ar" ? `${arCount(value, { one: "حجز واحد", two: "حجزين", few: "حجوزات", many: "حجز" })} شهريًا` : `${value} bookings / month`;
  }
  if (key === "staffMembers") {
    if (value === Infinity) return lang === "ar" ? "فريق غير محدود" : "Unlimited staff";
    return lang === "ar" ? `حتى ${arCount(value, { one: "فرد واحد", two: "فردين", few: "أفراد", many: "فرد" })}` : `Up to ${value} staff`;
  }
  if (key === "branches") {
    if (value === Infinity) return lang === "ar" ? "فروع غير محدودة" : "Unlimited branches";
    return label;
  }
  return value === Infinity ? `${label} — ${unlimited}` : label;
}

/** Every row for one plan, ready to render. */
export function featureRows(plan: Plan): FeatureRow[] {
  return FEATURE_ORDER.map((key) => {
    const value = PLAN_FEATURES[plan][key];
    const counted = typeof value === "number";
    return {
      key,
      enabled: allows(plan, key),
      ar: counted ? countLabel(key, value, "ar") : LABELS[key].ar,
      en: counted ? countLabel(key, value, "en") : LABELS[key].en,
    };
  });
}
