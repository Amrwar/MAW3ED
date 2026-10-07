import { cairoDateString } from "@/lib/bookings/instants";

/**
 * The calendar day a view belongs to, as a bare date.
 *
 * ProfileView.day is a DATE column, so what matters is the date part
 * and nothing else. It is built as UTC midnight of the Cairo calendar
 * day — not of the UTC day — because a visit at 01:00 Cairo on the 8th
 * is the 8th to the business whose shop it is, while in UTC it is still
 * the 7th. Getting that wrong moves a whole evening's traffic into the
 * previous day's row.
 *
 * The Cairo date itself comes from cairoDateString, which already knows
 * that Egypt is UTC+2 in winter and UTC+3 under summer time. There is
 * no second copy of that knowledge here.
 */
export function cairoDay(now: Date = new Date()): Date {
  return new Date(`${cairoDateString(now)}T00:00:00Z`);
}

/** The bare date `daysBack` days before today, for a range query. */
export function cairoDayBefore(daysBack: number, now: Date = new Date()): Date {
  return cairoDay(new Date(now.getTime() - daysBack * 86_400_000));
}
