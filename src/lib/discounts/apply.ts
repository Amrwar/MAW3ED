import type { DiscountKind } from "@prisma/client";

/**
 * Whether a discount applies, and what it is worth.
 *
 * Pure, so the rules can be tested without a database and so there is
 * exactly one of them. The booking route, the price preview the
 * customer sees before confirming and the owner's own test of a code
 * all ask this function — if they each decided for themselves, the
 * widget would quote one price and the ledger would charge another.
 *
 * Nothing here trusts a number from the browser. The caller passes what
 * the database says the service costs and what the database says has
 * been redeemed; the browser only ever supplies a code to look up.
 */

export interface DiscountRules {
  id: string;
  code: string | null;
  kind: DiscountKind;
  value: number;
  minSpendCents: number | null;
  maxDiscountCents: number | null;
  maxRedemptions: number | null;
  perCustomerLimit: number | null;
  redemptionCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  /** Empty means every service. */
  serviceIds: string[];
}

export interface DiscountContext {
  /** What the booking costs before any reduction, in piastres. */
  subtotalCents: number;
  serviceId: string;
  /** How many times this customer has already used this discount. */
  customerRedemptions: number;
  now: Date;
}

export type DiscountFailure =
  | "inactive"
  | "not-started"
  | "expired"
  | "wrong-service"
  | "below-minimum"
  | "exhausted"
  | "customer-limit"
  | "no-effect";

export type DiscountOutcome =
  | { ok: true; amountCents: number; totalCents: number }
  | { ok: false; reason: DiscountFailure };

/** Arabic for each refusal, written for the customer, not the developer. */
export const FAILURE_AR: Record<DiscountFailure, string> = {
  inactive: "الكود ده مش شغّال",
  "not-started": "الكود ده لسه مابدأش",
  expired: "الكود ده انتهت صلاحيته",
  "wrong-service": "الكود ده مش على الخدمة دي",
  "below-minimum": "قيمة الحجز أقل من الحد المطلوب للكود ده",
  exhausted: "الكود ده خلص عدد مرات استخدامه",
  "customer-limit": "إنت استخدمت الكود ده قبل كده",
  "no-effect": "الكود ده مش هيغيّر السعر",
};

/**
 * What this discount takes off, in piastres.
 *
 * Rounded down, so a 33% discount never takes off more than a third.
 * Capped at the subtotal: a fixed discount larger than the price makes
 * the booking free, never negative — nobody is owed money for turning
 * up — and capped again at maxDiscountCents when the business set one,
 * which is what stops a half-price offer costing more on an expensive
 * service than it was meant to.
 */
export function discountAmount(rules: DiscountRules, subtotalCents: number): number {
  const raw =
    rules.kind === "PERCENT"
      ? Math.floor((subtotalCents * rules.value) / 100)
      : rules.value;

  const capped = rules.maxDiscountCents != null ? Math.min(raw, rules.maxDiscountCents) : raw;
  return Math.max(0, Math.min(capped, subtotalCents));
}

/**
 * The whole decision.
 *
 * Checked in the order a person would explain it: is it on, is it
 * running, is it for this, is the basket big enough, is there any left.
 * The first failure is the one reported, so the message names the thing
 * the customer can actually do something about.
 */
export function evaluateDiscount(
  rules: DiscountRules,
  ctx: DiscountContext,
): DiscountOutcome {
  if (!rules.isActive) return { ok: false, reason: "inactive" };

  if (rules.startsAt && ctx.now < rules.startsAt) {
    return { ok: false, reason: "not-started" };
  }
  if (rules.endsAt && ctx.now >= rules.endsAt) {
    return { ok: false, reason: "expired" };
  }

  // Empty means every service, which is the common case and must not
  // be mistaken for "no services".
  if (rules.serviceIds.length > 0 && !rules.serviceIds.includes(ctx.serviceId)) {
    return { ok: false, reason: "wrong-service" };
  }

  if (rules.minSpendCents != null && ctx.subtotalCents < rules.minSpendCents) {
    return { ok: false, reason: "below-minimum" };
  }

  if (rules.maxRedemptions != null && rules.redemptionCount >= rules.maxRedemptions) {
    return { ok: false, reason: "exhausted" };
  }

  if (rules.perCustomerLimit != null && ctx.customerRedemptions >= rules.perCustomerLimit) {
    return { ok: false, reason: "customer-limit" };
  }

  const amountCents = discountAmount(rules, ctx.subtotalCents);

  // A discount worth nothing is refused rather than silently applied,
  // so a customer who typed a code is told it did nothing instead of
  // believing it worked.
  if (amountCents <= 0) return { ok: false, reason: "no-effect" };

  return { ok: true, amountCents, totalCents: ctx.subtotalCents - amountCents };
}

/**
 * The best automatic promotion for this booking, or none.
 *
 * Promotions have no code, so the customer never asks for one — they
 * are offered whichever is worth most to them. Ties go to the one that
 * ends soonest, so a limited offer is used before an open-ended one
 * rather than expiring unused beside it.
 */
export function bestAutomaticDiscount(
  candidates: DiscountRules[],
  ctx: DiscountContext,
): { rules: DiscountRules; amountCents: number; totalCents: number } | null {
  let best: { rules: DiscountRules; amountCents: number; totalCents: number } | null = null;

  for (const rules of candidates) {
    if (rules.code !== null) continue; // a coupon must be asked for
    const outcome = evaluateDiscount(rules, ctx);
    if (!outcome.ok) continue;

    if (
      !best ||
      outcome.amountCents > best.amountCents ||
      (outcome.amountCents === best.amountCents && endsSooner(rules, best.rules))
    ) {
      best = { rules, amountCents: outcome.amountCents, totalCents: outcome.totalCents };
    }
  }

  return best;
}

function endsSooner(a: DiscountRules, b: DiscountRules): boolean {
  if (!a.endsAt) return false;
  if (!b.endsAt) return true;
  return a.endsAt < b.endsAt;
}

/** Codes are compared case-insensitively and stored upper. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}
