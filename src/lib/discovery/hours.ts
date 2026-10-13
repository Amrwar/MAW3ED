/**
 * Opening-hours arithmetic for the discovery listing.
 *
 * Everything here works on the "HH:MM" strings the schema stores and on
 * a weekday number, with no database access, so the rules are testable
 * and the same reading is used by the SQL filter and by the card badge.
 *
 * Egypt does not currently observe DST year-round in a way that affects
 * these comparisons within a day, but the clock is always read in
 * Africa/Cairo rather than the server's zone — a Vercel function runs in
 * UTC, and "open now" computed in UTC is wrong by two or three hours.
 */

export const CAIRO = "Africa/Cairo";

export interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

/** Local weekday (0 = Sunday) and "HH:MM" wall clock in Cairo. */
export function cairoNow(now: Date = new Date()): { dayOfWeek: number; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CAIRO,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let hour = get("hour");
  // Intl can render midnight as "24" in some ICU versions.
  if (hour === "24") hour = "00";

  return {
    dayOfWeek: Math.max(0, days.indexOf(get("weekday"))),
    time: `${hour}:${get("minute")}`,
  };
}

/** Zero-padded "HH:MM" compares correctly as a plain string. */
export function isValidTime(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

/**
 * Is the business open at this wall-clock time on this day?
 *
 * A closing time at or before the opening time means the business trades
 * past midnight — 18:00 to 02:00 — so the window wraps.
 */
export function isOpenAt(rule: DayHours | undefined, time: string): boolean {
  if (!rule || rule.isClosed) return false;
  if (!isValidTime(rule.openTime) || !isValidTime(rule.closeTime)) return false;

  return rule.closeTime > rule.openTime
    ? time >= rule.openTime && time < rule.closeTime
    : time >= rule.openTime || time < rule.closeTime;
}

export function dayOffsetToWeekday(dayOfWeek: number, offset: number): number {
  return (dayOfWeek + offset + 7) % 7;
}

/**
 * How many days until this business is next open, counting today when it
 * is still open or has not opened yet. Returns null when every rule is
 * closed, which is a business that has not set its hours.
 */
export function daysUntilOpen(
  rules: DayHours[],
  nowDay: number,
  nowTime: string,
): number | null {
  const byDay = new Map(rules.map((r) => [r.dayOfWeek, r]));

  for (let offset = 0; offset < 7; offset++) {
    const rule = byDay.get(dayOffsetToWeekday(nowDay, offset));
    if (!rule || rule.isClosed) continue;
    if (!isValidTime(rule.openTime)) continue;

    // Today only counts while there is still time left to be served.
    if (offset === 0) {
      const stillOpen = isOpenAt(rule, nowTime);
      const notYetOpen = nowTime < rule.openTime;
      if (stillOpen || notYetOpen) return 0;
      continue;
    }
    return offset;
  }
  return null;
}

export type OpenState =
  | { state: "open"; closesAt: string }
  | { state: "closed"; opensInDays: number; opensAt: string }
  | { state: "unknown" };

/**
 * What the card badge says. "unknown" is a business with no hours set —
 * the card stays silent rather than guessing it is closed.
 */
export function openState(rules: DayHours[], nowDay: number, nowTime: string): OpenState {
  if (rules.length === 0) return { state: "unknown" };

  const today = rules.find((r) => r.dayOfWeek === nowDay);
  if (isOpenAt(today, nowTime) && today) {
    return { state: "open", closesAt: today.closeTime };
  }

  const offset = daysUntilOpen(rules, nowDay, nowTime);
  if (offset === null) return { state: "unknown" };

  const rule = rules.find((r) => r.dayOfWeek === dayOffsetToWeekday(nowDay, offset));
  if (!rule) return { state: "unknown" };

  return { state: "closed", opensInDays: offset, opensAt: rule.openTime };
}

/** Midnight today in Cairo, expressed the way bookings are stored (a UTC date). */
export function startOfCairoDay(now: Date = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
