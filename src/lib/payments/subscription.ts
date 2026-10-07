import { PLAN_PRICES_CENTS, isDowngrade, type Plan, type PaidPlan } from "@/lib/plans";

/** How long a paid period runs. */
export const PERIOD_DAYS = 30;

/**
 * When the new period ends.
 *
 * Measured from whatever is left rather than from today. Renewing with
 * eleven days still on the clock used to set the end to now + 30 and
 * throw those eleven days away, so the only safe time to renew was
 * after it had already lapsed — which is why the upgrade route refused
 * renewals more than a week out. It does not have to any more.
 */
export function renewalPeriodEnd(currentEnd: Date | null, from: Date = new Date()): Date {
  const base = currentEnd && currentEnd > from ? currentEnd : from;
  const end = new Date(base);
  end.setDate(end.getDate() + PERIOD_DAYS);
  return end;
}

export function priceCentsFor(plan: PaidPlan): number {
  return PLAN_PRICES_CENTS[plan];
}

export interface UpgradeCheck {
  ok: boolean;
  /** Arabic, shown to the owner. */
  reason?: string;
}

/**
 * Whether this business may buy this plan right now.
 *
 * Downgrades are refused here because there is nothing to charge for
 * one; moving down happens by letting the period run out, which is the
 * only version of it that does not involve refunding a part-month.
 *
 * Renewing the same plan is allowed at any time, early or late. The
 * days are added to what is left, so paying early costs nothing.
 */
export function canPurchase(params: {
  currentPlan: Plan;
  targetPlan: PaidPlan;
  status: "TRIAL" | "ACTIVE" | "INACTIVE";
}): UpgradeCheck {
  const { currentPlan, targetPlan, status } = params;

  // A lapsed subscription may buy anything, including what it had.
  if (status === "INACTIVE") return { ok: true };

  if (isDowngrade(currentPlan, targetPlan)) {
    return {
      ok: false,
      reason: "للرجوع لخطة أقل، سيب الاشتراك الحالي يخلص وبعدها اختار الخطة الجديدة.",
    };
  }

  return { ok: true };
}
