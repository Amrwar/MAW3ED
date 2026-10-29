import { addDays } from "@/lib/bookings/instants";
import { wrapClock } from "@/lib/bookings/time";

/**
 * "الثلاثاء، 7 أكتوبر — 14:00", for notification copy.
 *
 * Kept apart from the display formatters because this one is written
 * into a stored string: it has to read correctly months later, long
 * after any "tomorrow" would have stopped being true.
 */
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const AR_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function formatWhen(date: Date, startTime: string): string {
  // A table at "25:00" is one in the morning of the following day; the
  // message names the day the customer will actually turn up.
  const { time, nextDay } = wrapClock(startTime);
  const when = nextDay ? new Date(`${addDays(date.toISOString().slice(0, 10), 1)}T00:00:00Z`) : date;
  const d = when.getUTCDate();
  const m = when.getUTCMonth();
  const dow = when.getUTCDay();
  return `${AR_DAYS[dow]}، ${d} ${AR_MONTHS[m]} — ${time}`;
}
