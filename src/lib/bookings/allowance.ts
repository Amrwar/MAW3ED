import { db } from "@/lib/db";
import { getEffectivePlan, getMonthlyBookingLimit } from "@/lib/plans";
import { countedThisMonth } from "./create";

/**
 * Which of these businesses have used up their plan's monthly allowance.
 *
 * Past it, an online booking is still taken but waits for the owner
 * (lib/bookings/create, overLimit "hold"), so a business there must not
 * be advertised as confirming instantly. Two queries for any number of
 * businesses: their plans, then one count grouped by business.
 */
export async function overAllowance(ids: string[], now: Date = new Date()): Promise<Set<string>> {
  if (ids.length === 0) return new Set();

  const businesses = await db.business.findMany({
    where: { id: { in: ids } },
    select: { id: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  const limits = new Map<string, number>();
  for (const b of businesses) {
    const limit = getMonthlyBookingLimit(getEffectivePlan(b.plan, b.subscriptionStatus, b.trialEndsAt));
    if (Number.isFinite(limit)) limits.set(b.id, limit);
  }
  if (limits.size === 0) return new Set();

  const counts = await db.booking.groupBy({
    by: ["businessId"],
    where: { ...countedThisMonth("", now), businessId: { in: [...limits.keys()] } },
    _count: { _all: true },
  });
  return new Set(counts.filter((c) => c._count._all >= (limits.get(c.businessId) ?? Infinity)).map((c) => c.businessId));
}

/** Clears autoConfirm on the businesses past their allowance, in place. */
export async function settleInstantBadges<T extends { id: string; autoConfirm: boolean }>(
  items: T[],
  now: Date = new Date(),
): Promise<void> {
  const over = await overAllowance(items.filter((i) => i.autoConfirm).map((i) => i.id), now);
  for (const item of items) if (over.has(item.id)) item.autoConfirm = false;
}
