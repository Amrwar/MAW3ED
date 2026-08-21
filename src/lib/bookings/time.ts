/**
 * Pure time arithmetic for bookings.
 *
 * These used to sit in `overlap.ts` under a comment promising they were
 * "safe to call anywhere". They were not: that module imports the Prisma
 * client at the top, so anything reaching for `timeToMinutes` pulled a
 * database connection in with it. They live here now, and `overlap.ts`
 * re-exports them so existing call sites are unchanged.
 *
 * The rule everything below serves: two bookings conflict when their time
 * ranges overlap. Intervals are half-open — [start, end) — so a booking
 * ending exactly when another starts is NOT a conflict.
 */

/** Convert "HH:MM" to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes since midnight back to "HH:MM". */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Pure overlap check for two half-open intervals [aStart, aEnd) and [bStart, bEnd).
 * Returns true when the intervals share at least one minute.
 */
export function overlaps(
  aStart: number,
  aEnd:   number,
  bStart: number,
  bEnd:   number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}
