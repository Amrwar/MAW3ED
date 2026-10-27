import { PLAN_PRICES_EGP, isDowngrade, planPriceCents, type BillingCycle, type Plan, type PaidPlan } from "@/lib/plans";

/** How long a paid month runs. */
export const PERIOD_DAYS = 30;

/** How long a paid year runs. */
export const YEAR_DAYS = 365;

/**
 * When the new period ends.
 *
 * Measured from whatever is left rather than from today. Renewing with
 * eleven days still on the clock used to set the end to now + 30 and
 * throw those eleven days away, so the only safe time to renew was
 * after it had already lapsed — which is why the upgrade route refused
 * renewals more than a week out. It does not have to any more.
 */
export function renewalPeriodEnd(
  currentEnd: Date | null,
  from: Date = new Date(),
  /** 12 for an annual purchase; anything else is a month. */
  months: number = 1,
): Date {
  const base = currentEnd && currentEnd > from ? currentEnd : from;
  const end = new Date(base);
  end.setDate(end.getDate() + (months === 12 ? YEAR_DAYS : PERIOD_DAYS));
  return end;
}

/**
 * When the period a purchase buys ends, given what the business is on.
 *
 * Renewing the same plan adds the new period to what is left. Moving
 * up a plan cannot do that as it stands: the days left were paid for
 * at the cheaper plan's price, and carried over unchanged a year of
 * Pro bought one month of Premium for thirteen months of Premium. So
 * what is left is converted first — worth old price ÷ new price as
 * many days of the new plan — and the new period goes on after it.
 */
export function purchasePeriodEnd(params: {
  currentPlan: Plan;
  currentEnd: Date | null;
  newPlan: PaidPlan;
  /** 1 or 12. */
  months: number;
  now?: Date;
}): Date {
  const { currentPlan, currentEnd, newPlan, months, now = new Date() } = params;
  const left = currentEnd && currentEnd > now ? currentEnd.getTime() - now.getTime() : 0;
  const credit =
    currentPlan === newPlan
      ? left
      : Math.floor((left * PLAN_PRICES_EGP[currentPlan]) / PLAN_PRICES_EGP[newPlan]);
  return renewalPeriodEnd(new Date(now.getTime() + credit), now, months);
}

export function priceCentsFor(plan: PaidPlan, cycle: BillingCycle = "monthly"): number {
  return planPriceCents(plan, cycle);
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
