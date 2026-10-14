import { cairoDateString, cairoMinutes, dateToUTC } from "./instants";
import { timeToMinutes } from "./time";

/**
 * What a customer may do to their own booking from its link.
 *
 * One rule, read by the booking page (to decide what to offer) and by
 * the cancel and reschedule routes (to decide what to allow), so the
 * page never offers what the API then refuses.
 */

/** How close to the start a customer can still cancel or move it. */
export const CUTOFF_HOURS = 2;

const CHANGEABLE = ["PENDING", "CONFIRMED"] as const;

/**
 * Minutes from now until the booking starts, both on Cairo's wall clock.
 *
 * Booking.date is UTC midnight of the Cairo day and startTime is Cairo
 * wall-clock, so the start must be compared with Cairo's wall clock —
 * not with `Date.now()`. Reading "14:00" as 14:00 UTC put the cutoff
 * two or three hours late: a booking 90 minutes away could still be
 * cancelled.
 */
export function minutesUntilStart(
  date: Date,
  startTime: string,
  now: Date = new Date(),
): number {
  const start = date.getTime() / 60_000 + timeToMinutes(startTime);
  const nowWall = dateToUTC(cairoDateString(now)).getTime() / 60_000 + cairoMinutes(now);
  return start - nowWall;
}

/** Whether the customer may still cancel or reschedule. */
export function customerMayChange(
  booking: { status: string; date: Date; startTime: string },
  now: Date = new Date(),
): boolean {
  if (!(CHANGEABLE as readonly string[]).includes(booking.status)) return false;
  return minutesUntilStart(booking.date, booking.startTime, now) > CUTOFF_HOURS * 60;
}

/**
 * Whether the customer may cancel.
 *
 * Everything customerMayChange allows, and also a booking still waiting
 * on its deposit: walking away from the payment page should not leave
 * them holding a slot they no longer want until the reaper gets to it.
 * Nothing has been paid, so there is no cutoff to protect the business —
 * only an appointment that has not started yet.
 */
export function customerMayCancel(
  booking: { status: string; date: Date; startTime: string },
  now: Date = new Date(),
): boolean {
  if (booking.status === "PENDING_PAYMENT") {
    return minutesUntilStart(booking.date, booking.startTime, now) > 0;
  }
  return customerMayChange(booking, now);
}
