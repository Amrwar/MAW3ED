/**
 * Loyalty arithmetic, pure (docs/architecture/LOYALTY_LEDGER.md).
 *
 * Points are whole numbers; money is piastres. Nothing here touches the
 * database, so every rule is unit-tested on its own.
 */

export interface ProgramRules {
  pointsPerVisit: number;
  /** Points per 100 EGP of completed value (0 = spend-based earning off). */
  pointsPer100Egp: number;
  /** redeemPoints points are worth redeemValueCents. */
  redeemPoints: number;
  redeemValueCents: number;
  /** At most this share of a booking's price may be paid in points. */
  maxRedeemPercent: number;
  expiryDays: number | null;
  dailyEarnCap: number;
}

/** Points a completed visit earns: per visit, plus per 100 EGP of its value. */
export function pointsForVisit(rules: ProgramRules, valueCents: number): number {
  const spend = rules.pointsPer100Egp > 0 ? Math.floor((Math.max(0, valueCents) * rules.pointsPer100Egp) / 10_000) : 0;
  return Math.max(0, rules.pointsPerVisit) + spend;
}

/**
 * What spending points on a booking does. Points are spent only in whole
 * units of redeemPoints; the discount is capped at maxRedeemPercent of the
 * price, and never more than the price. Returns the points actually spent
 * and the piastres they take off — both 0 when nothing can be redeemed.
 */
export function redemptionFor(
  rules: ProgramRules,
  requestedPoints: number,
  availablePoints: number,
  priceCents: number,
): { points: number; amountCents: number } {
  if (requestedPoints <= 0 || availablePoints <= 0 || priceCents <= 0) return { points: 0, amountCents: 0 };
  const capCents = Math.floor((priceCents * Math.min(100, Math.max(0, rules.maxRedeemPercent))) / 100);
  const maxUnitsByCap = Math.floor(capCents / rules.redeemValueCents);
  const units = Math.min(
    Math.floor(Math.min(requestedPoints, availablePoints) / rules.redeemPoints),
    maxUnitsByCap,
  );
  if (units <= 0) return { points: 0, amountCents: 0 };
  return { points: units * rules.redeemPoints, amountCents: units * rules.redeemValueCents };
}

/** When a lot earned at `at` expires; null when the program's points never do. */
export function lotExpiry(rules: Pick<ProgramRules, "expiryDays">, at: Date): Date | null {
  return rules.expiryDays ? new Date(at.getTime() + rules.expiryDays * 86_400_000) : null;
}

export interface Lot {
  id: string;
  remaining: number;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Which lots to draw `points` from: oldest expiry first (a lot that never
 * expires last), then oldest first. Expired lots are skipped. Returns the
 * draws and how much could not be covered.
 */
export function drawFromLots(lots: Lot[], points: number, now: Date): { draws: { id: string; take: number }[]; shortfall: number } {
  const usable = lots
    .filter((l) => l.remaining > 0 && (l.expiresAt === null || l.expiresAt > now))
    .sort((a, b) => {
      const ea = a.expiresAt?.getTime() ?? Infinity;
      const eb = b.expiresAt?.getTime() ?? Infinity;
      return ea - eb || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);
    });
  const draws: { id: string; take: number }[] = [];
  let left = Math.max(0, points);
  for (const l of usable) {
    if (left === 0) break;
    const take = Math.min(l.remaining, left);
    draws.push({ id: l.id, take });
    left -= take;
  }
  return { draws, shortfall: left };
}

/** Points available to spend now: unexpired lots only. */
export function availablePoints(lots: Lot[], now: Date): number {
  return lots.reduce((n, l) => n + (l.remaining > 0 && (l.expiresAt === null || l.expiresAt > now) ? l.remaining : 0), 0);
}
