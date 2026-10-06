import { timeToMinutes } from "./time";

/**
 * Dates, times and the one place they are turned into each other.
 *
 * A booking is stored as three things: a date at UTC midnight, and two
 * "HH:MM" strings that are Cairo wall-clock. startsAt and endsAt express
 * the same appointment as an interval, which is what the overlap
 * constraint in the database is defined over.
 *
 * They are deliberately plain timestamps rather than instants with a
 * zone. Egypt's clock changes twice a year; an appointment at 14:00 is
 * at 14:00 either side of the change, and anchoring the interval to the
 * wall clock keeps the stored range matching what everyone agreed to.
 * Every booking for a business uses the same frame, so overlap
 * detection is exact.
 */

export const CAIRO = "Africa/Cairo";

/** YYYY-MM-DD for a date, in Cairo. */
export function cairoDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAIRO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Minutes since midnight, in Cairo. */
export function cairoMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return Number(hour) * 60 + Number(get("minute"));
}

/** Weekday for a YYYY-MM-DD string, 0 = Sunday, with no zone drift. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** UTC midnight for a YYYY-MM-DD string — how `Booking.date` is stored. */
export function dateToUTC(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole days between two YYYY-MM-DD strings. Negative when `date` is past. */
export function daysBetween(today: string, date: string): number {
  return Math.round((dateToUTC(date).getTime() - dateToUTC(today).getTime()) / 86_400_000);
}

/**
 * The interval a booking occupies, as stored in startsAt/endsAt.
 *
 * endTime is authoritative when present; otherwise the duration decides,
 * which is the same fallback the conflict checker has always used for
 * rows written before endTime existed.
 */
export function bookingInstants(
  date: string,
  startTime: string,
  endTime: string | null,
  durationMinutes: number,
): { startsAt: Date; endsAt: Date } {
  const base = dateToUTC(date).getTime();
  const startMin = timeToMinutes(startTime);
  const endMin = endTime ? timeToMinutes(endTime) : startMin + durationMinutes;

  return {
    startsAt: new Date(base + startMin * 60_000),
    endsAt: new Date(base + endMin * 60_000),
  };
}

/** YYYY-MM-DD, n days after the given one. */
export function addDays(date: string, n: number): string {
  const d = dateToUTC(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
