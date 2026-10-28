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

/**
 * The instant the Cairo day containing `now` began.
 *
 * Needed because "today's bookings" is a Cairo day, while bookings are
 * stored as instants. Egypt is UTC+2 in winter and UTC+3 under summer
 * time, so the offset cannot be assumed — and it is not enough to find
 * *an* instant on the right day, which is the mistake that costs you
 * the first hour: 01:00 Cairo is also "today". The candidate is only
 * the start if the millisecond before it belongs to the previous day.
 */
export function cairoDayStart(now: Date = new Date()): Date {
  const day = cairoDateString(now);
  const utcMidnight = new Date(`${day}T00:00:00Z`);

  for (const offsetHours of [3, 2]) {
    const candidate = new Date(utcMidnight.getTime() - offsetHours * 3_600_000);
    if (
      cairoDateString(candidate) === day &&
      cairoDateString(new Date(candidate.getTime() - 1)) !== day
    ) {
      return candidate;
    }
  }
  return utcMidnight;
}

/** The instant the Cairo day containing `now` ends. */
export function cairoDayEnd(now: Date = new Date()): Date {
  return new Date(cairoDayStart(now).getTime() + 86_400_000);
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

/**
 * Now, in the same frame as startsAt/endsAt: Cairo wall-clock written as
 * if it were UTC, to the minute. Comparing a stored interval with a real
 * `new Date()` would be off by Cairo's offset (two or three hours); this
 * is the value to compare against instead.
 */
export function cairoWallClock(now: Date = new Date()): Date {
  return new Date(dateToUTC(cairoDateString(now)).getTime() + cairoMinutes(now) * 60_000);
}

/**
 * Today in Cairo, in the startsAt frame: from its midnight to the next.
 * What a "today" list filters startsAt on. cairoDayStart/End are real
 * instants, which against startsAt drop every booking from 22:00 (21:00
 * in summer) and pick up the previous evening's instead.
 */
export function cairoWallDay(now: Date = new Date()): { start: Date; end: Date } {
  const start = dateToUTC(cairoDateString(now));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** A booking's start in the startsAt frame, for rows written before startsAt existed. */
export function bookingStart(b: { startsAt?: Date | null; date: Date; startTime: string }): Date {
  if (b.startsAt) return b.startsAt;
  return new Date(b.date.getTime() + timeToMinutes(b.startTime) * 60_000);
}
