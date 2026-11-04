/**
 * Packages and memberships, the arithmetic (docs/architecture/MEMBERSHIPS_AND_PACKAGES.md).
 * Pure: no database, unit-tested on its own.
 */

const DAY = 86_400_000;

/** Pause allowance over a membership's life. */
export const MAX_PAUSE_DAYS = 60;
/** A membership may be paid at most this many periods ahead of now. */
export const MAX_PERIODS_AHEAD = 2;

/** A service is covered when the plan names it, or names none (any service). */
export function coversService(serviceIds: readonly string[], serviceId: string): boolean {
  return serviceIds.length === 0 || serviceIds.includes(serviceId);
}

/** When a package sold at `at` stops being usable. */
export function packageExpiry(at: Date, validityDays: number): Date {
  return new Date(at.getTime() + validityDays * DAY);
}

/**
 * The next period a renewal pays for. A membership still running is
 * extended from where it is paid to, so paying early never shortens or
 * resets the current period; one that lapsed starts again now.
 * Null when it is already paid MAX_PERIODS_AHEAD ahead.
 */
export function nextPeriod(
  paidThrough: Date | null,
  periodDays: number,
  now: Date,
): { startsAt: Date; endsAt: Date } | null {
  const startsAt = paidThrough && paidThrough > now ? paidThrough : now;
  if (startsAt.getTime() - now.getTime() >= (MAX_PERIODS_AHEAD - 1) * periodDays * DAY) return null;
  return { startsAt, endsAt: new Date(startsAt.getTime() + periodDays * DAY) };
}

/**
 * How long a pause that ends now counts for, in whole days (nearest — a
 * pause of minutes costs and gives nothing), and how far
 * the paid periods move: never past what is left of the allowance.
 */
export function pauseShift(pausedAt: Date, now: Date, pausedDaysSoFar: number): { days: number; ms: number } {
  const left = Math.max(0, MAX_PAUSE_DAYS - pausedDaysSoFar);
  const days = Math.min(left, Math.max(0, Math.round((now.getTime() - pausedAt.getTime()) / DAY)));
  return { days, ms: days * DAY };
}

/** When a pause runs out of allowance and the membership resumes by itself. */
export function pauseRunsOutAt(pausedAt: Date, pausedDaysSoFar: number): Date {
  return new Date(pausedAt.getTime() + Math.max(0, MAX_PAUSE_DAYS - pausedDaysSoFar) * DAY);
}

/**
 * What refunding the unused part of a package would return: the price,
 * pro rata to the sessions not taken, less what was refunded already.
 * A suggestion; the owner decides (and may refund less).
 */
export function unusedPackageRefund(priceCents: number, total: number, used: number, refundedCents: number): number {
  if (total <= 0) return 0;
  const unused = Math.max(0, total - Math.max(0, used));
  return Math.max(0, Math.floor((priceCents * unused) / total) - Math.max(0, refundedCents));
}
