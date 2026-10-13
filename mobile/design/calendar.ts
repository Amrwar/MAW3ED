/**
 * Calendar arithmetic on "YYYY-MM-DD" strings, in UTC.
 *
 * Bookings are Cairo calendar days, not instants, so dates here never
 * pass through the phone's timezone: a traveller in New York booking a
 * Cairo salon must see the salon's days. Everything is computed on UTC
 * midnight, where no daylight-saving hour can move a date.
 */

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, n: number): string {
  const d = fromIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  return fromIso(iso).getUTCDay();
}

/** Today in Cairo, which is the calendar every booking is in. */
export function cairoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The first day of the month containing `iso`. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** The first day of the month `n` months away. */
export function addMonths(iso: string, n: number): string {
  const d = fromIso(monthStart(iso));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toIso(d);
}

/**
 * A month as weeks of seven, for a calendar grid. Days outside the
 * month are null, so the grid keeps its shape without showing another
 * month's dates as if they were choosable.
 *
 * `weekStartsOn` defaults to Saturday — the Egyptian week.
 */
export function monthGrid(iso: string, weekStartsOn = 6): (string | null)[][] {
  const first = monthStart(iso);
  const d = fromIso(first);
  const month = d.getUTCMonth();
  const lead = (weekdayOf(first) - weekStartsOn + 7) % 7;

  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  while (d.getUTCMonth() === month) {
    cells.push(toIso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** The seven weekdays in grid order, as dates in a known week, for their names. */
export function weekdayHeaders(weekStartsOn = 6): string[] {
  // 2026-01-04 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => addDays("2026-01-04", (weekStartsOn + i) % 7));
}

/** `count` consecutive days from `from`. */
export function daysFrom(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}
