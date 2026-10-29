import { timeToMinutes } from "./time";

/**
 * Dates, times and the one place they are turned into each other.
 *
 * A booking is stored as three things: a date at UTC midnight, and two
 * "HH:MM" strings that are the business's wall-clock. startsAt and
 * endsAt express the same appointment as an interval, which is what
 * the overlap constraint in the database is defined over.
 *
 * They are deliberately plain timestamps rather than instants with a
 * zone. Egypt's clock changes twice a year; an appointment at 14:00 is
 * at 14:00 either side of the change, and anchoring the interval to the
 * wall clock keeps the stored range matching what everyone agreed to.
 * Every booking for a business uses the same frame, so overlap
 * detection is exact.
 *
 * Nothing here knows Cairo's offset. Every conversion between a wall
 * clock and a real instant asks Intl for the zone's rules at that
 * moment, so the two summer-time changes a year, and any future change
 * to them, come from the platform's zone data rather than from a
 * number in this file. Every function takes the zone as its last
 * argument; the platform runs on one zone today (`DEFAULT_TZ`), and a
 * business in another would pass its own.
 */

export const CAIRO = "Africa/Cairo";
/** The zone every business is in until a business carries its own. */
export const DEFAULT_TZ = CAIRO;

const MIN = 60_000;
const DAY = 86_400_000;

/* ─── The zone's rules, from Intl ────────────────────────── */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function wallParts(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** The wall clock in `tz` at `instant`, as numbers. */
function wallAt(instant: Date, tz: string) {
  const parts = wallParts(tz).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  // Some ICU builds print midnight as "24" with hourCycle h23 on older
  // engines; normalise so the arithmetic below never sees it.
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

/**
 * How far `tz` is from UTC at `instant`, in minutes, east positive.
 * Africa/Cairo answers 120 in winter and 180 under summer time — read
 * from the zone data for that moment, never assumed.
 */
export function zoneOffsetMinutes(instant: Date, tz: string = DEFAULT_TZ): number {
  const w = wallAt(instant, tz);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - whole) / MIN);
}

/** YYYY-MM-DD for an instant, in the zone. */
export function zonedDateString(now: Date = new Date(), tz: string = DEFAULT_TZ): string {
  const w = wallAt(now, tz);
  return `${w.y}-${String(w.mo).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
}

/** Minutes since midnight on the zone's wall clock. */
export function zonedMinutes(now: Date = new Date(), tz: string = DEFAULT_TZ): number {
  const w = wallAt(now, tz);
  return w.h * 60 + w.mi;
}

/**
 * The instant at which the wall clock in `tz` reads `minutes` past
 * midnight on `date`. Minutes may exceed a day (a business trading past
 * midnight stores 01:00 as 25:00 on the day it opened).
 *
 * On the night the clocks change the wall clock is not a function of
 * the instant: a spring-forward skips an hour and a fall-back repeats
 * one. A repeated time resolves to its first occurrence (the earlier
 * instant); a time inside the skipped hour is moved forward by the
 * length of the skip, so 00:30 on a night the clock jumped from 00:00
 * to 01:00 is honoured at 01:30 — the same rule Java and most calendar
 * software apply. Both are decided by the zone data, not by this code.
 */
export function wallToInstant(date: string, minutes: number, tz: string = DEFAULT_TZ): Date {
  const asIfUtc = dateToUTC(date).getTime() + minutes * MIN;
  // The offsets in force a day either side cover both sides of any
  // transition within the day; each gives a candidate instant.
  const offsets = [...new Set([
    zoneOffsetMinutes(new Date(asIfUtc - DAY), tz),
    zoneOffsetMinutes(new Date(asIfUtc), tz),
    zoneOffsetMinutes(new Date(asIfUtc + DAY), tz),
  ])];
  const candidates = offsets.map((o) => asIfUtc - o * MIN).sort((a, b) => a - b);
  // A candidate is right when the wall clock at that instant reads the
  // time asked for. Earliest first, so a repeated hour's first pass wins.
  for (const t of candidates) {
    const w = wallAt(new Date(t), tz);
    if (Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi) === asIfUtc) return new Date(t);
  }
  // None does: the time fell in a gap. The latest candidate is the one
  // computed with the offset from before the jump, which lands on the
  // requested wall time shifted forward by the skip (00:30 → 01:30).
  return new Date(candidates[candidates.length - 1]);
}

/** The instant the zone's day containing `now` began: its midnight, whatever the offset was then. */
export function zonedDayStart(now: Date = new Date(), tz: string = DEFAULT_TZ): Date {
  return wallToInstant(zonedDateString(now, tz), 0, tz);
}

/**
 * The instant the zone's day containing `now` ends: the next day's
 * midnight. Not "start + 24 hours": the day the clocks go back is 25
 * hours long and the day they go forward is 23.
 */
export function zonedDayEnd(now: Date = new Date(), tz: string = DEFAULT_TZ): Date {
  return wallToInstant(addDays(zonedDateString(now, tz), 1), 0, tz);
}

/* ─── Cairo-named conveniences (the platform's zone) ─────── */

/** YYYY-MM-DD for a date, in Cairo. */
export function cairoDateString(now: Date = new Date()): string {
  return zonedDateString(now, CAIRO);
}

/**
 * The instant the Cairo day containing `now` began.
 *
 * Needed because "today's bookings" is a Cairo day, while bookings are
 * stored as instants. Egypt is UTC+2 in winter and UTC+3 under summer
 * time, so the offset cannot be assumed — and it is not enough to find
 * *an* instant on the right day, which is the mistake that costs you
 * the first hour: 01:00 Cairo is also "today".
 */
export function cairoDayStart(now: Date = new Date()): Date {
  return zonedDayStart(now, CAIRO);
}

/** The instant the Cairo day containing `now` ends. */
export function cairoDayEnd(now: Date = new Date()): Date {
  return zonedDayEnd(now, CAIRO);
}

/** Minutes since midnight, in Cairo. */
export function cairoMinutes(now: Date = new Date()): number {
  return zonedMinutes(now, CAIRO);
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
  return Math.round((dateToUTC(date).getTime() - dateToUTC(today).getTime()) / DAY);
}

/**
 * The interval a booking occupies, as stored in startsAt/endsAt.
 *
 * endTime is authoritative when present; otherwise the duration decides,
 * which is the same fallback the conflict checker has always used for
 * rows written before endTime existed. Times past midnight ("25:30")
 * land on the next calendar day, which is what the overlap constraint
 * needs to see.
 */
export function bookingInstants(
  date: string,
  startTime: string,
  endTime: string | null,
  durationMinutes: number,
): { startsAt: Date; endsAt: Date } {
  const base = dateToUTC(date).getTime();
  const startMin = timeToMinutes(startTime);
  let endMin = endTime ? timeToMinutes(endTime) : startMin + durationMinutes;
  // A legacy row whose endTime wrapped past midnight ("01:00" after a
  // "23:30" start) reads as ending before it starts; the duration says
  // what was meant.
  if (endMin <= startMin) endMin = startMin + durationMinutes;

  return {
    startsAt: new Date(base + startMin * MIN),
    endsAt: new Date(base + endMin * MIN),
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
  return wallClock(now, CAIRO);
}

/** `cairoWallClock` for any zone. */
export function wallClock(now: Date = new Date(), tz: string = DEFAULT_TZ): Date {
  return new Date(dateToUTC(zonedDateString(now, tz)).getTime() + zonedMinutes(now, tz) * MIN);
}

/**
 * Today in Cairo, in the startsAt frame: from its midnight to the next.
 * What a "today" list filters startsAt on. cairoDayStart/End are real
 * instants, which against startsAt drop every booking from 22:00 (21:00
 * in summer) and pick up the previous evening's instead.
 */
export function cairoWallDay(now: Date = new Date()): { start: Date; end: Date } {
  const start = dateToUTC(cairoDateString(now));
  return { start, end: new Date(start.getTime() + DAY) };
}

/** A booking's start in the startsAt frame, for rows written before startsAt existed. */
export function bookingStart(b: { startsAt?: Date | null; date: Date; startTime: string }): Date {
  if (b.startsAt) return b.startsAt;
  return new Date(b.date.getTime() + timeToMinutes(b.startTime) * MIN);
}

/**
 * The real instant a booking starts — the one to put in a calendar
 * invitation or to compare with the real clock. The stored start is a
 * wall-clock reading; this applies the zone's offset for that very day,
 * so an appointment the week after the clocks change is not an hour out.
 */
export function bookingStartInstant(
  b: { date: Date; startTime: string },
  tz: string = DEFAULT_TZ,
): Date {
  return wallToInstant(b.date.toISOString().slice(0, 10), timeToMinutes(b.startTime), tz);
}
