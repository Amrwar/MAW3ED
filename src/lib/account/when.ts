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
  const d = date.getUTCDate();
  const m = date.getUTCMonth();
  const dow = date.getUTCDay();
  return `${AR_DAYS[dow]}، ${d} ${AR_MONTHS[m]} — ${startTime}`;
}
