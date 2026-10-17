import { bookingStart, cairoWallClock } from "./instants";

/**
 * When a booking may be moved along the day-of path.
 *
 * A booking that has not happened cannot have been attended, finished
 * or missed. Letting an owner mark next week's appointment COMPLETED
 * also opened a review for something that has not taken place, so the
 * moves are tied to the clock:
 *
 * - ARRIVED and IN_PROGRESS from ARRIVE_EARLY_MINUTES before the start.
 *   Customers turn up early, and a salon that can start a client who is
 *   already in the chair ten minutes early should not have to wait for
 *   the clock; half an hour covers that without letting a booking be
 *   "started" the day before.
 * - COMPLETED and NO_SHOW only once the start time has passed: you
 *   cannot finish what has not begun, nor miss what is still to come.
 *
 * CONFIRMED and CANCELLED are not time-bound.
 *
 * Times are compared in the startsAt frame (Cairo wall clock written as
 * UTC), see lib/bookings/instants.
 */
export const ARRIVE_EARLY_MINUTES = 30;

const EARLY_OK = new Set(["ARRIVED", "IN_PROGRESS"]);
const AFTER_START = new Set(["COMPLETED", "NO_SHOW"]);

export function earliestFor(
  status: string,
  b: { startsAt?: Date | null; date: Date; startTime: string },
): Date | null {
  const start = bookingStart(b);
  if (EARLY_OK.has(status)) return new Date(start.getTime() - ARRIVE_EARLY_MINUTES * 60_000);
  if (AFTER_START.has(status)) return start;
  return null;
}

/** True when moving `b` to `status` now would be before its time. */
export function isTooEarly(
  status: string,
  b: { startsAt?: Date | null; date: Date; startTime: string },
  now: Date = new Date(),
): boolean {
  const earliest = earliestFor(status, b);
  return earliest !== null && cairoWallClock(now).getTime() < earliest.getTime();
}

/** The statuses from `candidates` that are allowed at this moment. */
export function allowedNow<S extends string>(
  candidates: readonly S[],
  b: { startsAt?: Date | null; date: Date; startTime: string },
  now: Date = new Date(),
): S[] {
  return candidates.filter((s) => !isTooEarly(s, b, now));
}
