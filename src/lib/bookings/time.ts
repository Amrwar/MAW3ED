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

/**
 * Format minutes since midnight back to "HH:MM". Past midnight keeps
 * counting — 1500 is "25:00" — because a booking belongs to the business
 * day it was opened in: a lounge trading until 02:00 lists its 01:00
 * table under the evening's date, and the overlap arithmetic for that
 * day stays on one axis. `wrapClock` turns it back into a clock reading.
 */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * A stored "HH:MM" as a clock reading: hours past 24 wrap to the next
 * day, and `nextDay` says so, so a display can mark it ("01:00 +1").
 */
export function wrapClock(value: string): { time: string; nextDay: boolean } {
  const [hRaw = "0", m = "00"] = value.split(":");
  const h = Number(hRaw);
  if (!Number.isFinite(h) || h < 24) return { time: `${hRaw.padStart(2, "0")}:${m.padStart(2, "0")}`, nextDay: false };
  return { time: `${String(h % 24).padStart(2, "0")}:${m.padStart(2, "0")}`, nextDay: true };
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
