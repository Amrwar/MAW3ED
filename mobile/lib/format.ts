/**
 * Numbers, money, dates and times, formatted the way the web formats
 * them.
 *
 * The locale is "ar-EG-u-nu-latn" everywhere: Arabic Egypt, but with
 * Latin digits. Egyptian users read prices and times in 1234, not
 * ١٢٣٤, and the web settled on this after the same question came up
 * there. One decision, both products.
 */

const LOCALE = "ar-EG-u-nu-latn";

/** A count. Never used for money — that needs the currency. */
export function num(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/**
 * A price.
 *
 * Returns null for null, so a caller has to decide what "no price set"
 * looks like rather than being handed "0 ج.م". A service priced by
 * arrangement is not a free service, and the web had to remove exactly
 * that bug.
 */
export function money(value: number | null, currency = "EGP"): string | null {
  if (value === null) return null;
  const formatted = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
  return `${formatted} ${currency === "EGP" ? "ج.م" : currency}`;
}

/** "45 دقيقة" / "ساعة ونص" is over-clever; minutes are clear. */
export function duration(minutes: number): string {
  if (minutes < 60) return `${num(minutes)} دقيقة`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursPart = hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : `${num(hours)} ساعات`;
  return rest ? `${hoursPart} و${num(rest)} دقيقة` : hoursPart;
}

/**
 * "الأحد 12 أكتوبر" from a "YYYY-MM-DD".
 *
 * Parsed as UTC on purpose. A date string carries no timezone, and
 * `new Date("2026-10-12")` is already UTC midnight — formatting that in
 * a timezone behind UTC prints the 11th. Everything in this product is
 * Cairo time, which is ahead of UTC, but the phone decides its own
 * timezone and a traveller should not see yesterday's date.
 */
export function longDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

/** "12 أكتوبر" — for lists, where the weekday is noise. */
export function shortDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** "14:30" to "2:30 م". */
export function time(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  // A malformed value is returned as-is rather than rendered as
  // "NaN:NaN". It comes from the database, so it should not happen —
  // but a clock that reads NaN is worse than one that reads oddly.
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h < 12 ? "ص" : "م";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * "بعد ساعتين", "النهاردة", "من 3 أيام".
 *
 * Takes the minutesUntil the server already computed, rather than
 * comparing against the device clock — a phone with the wrong time
 * would otherwise show an appointment as missed.
 */
export function relativeTime(minutesUntil: number): string {
  const past = minutesUntil < 0;
  const mins = Math.abs(minutesUntil);

  if (mins < 60) {
    const label = `${num(Math.max(1, Math.round(mins)))} دقيقة`;
    return past ? `من ${label}` : `بعد ${label}`;
  }
  if (mins < 60 * 24) {
    const hours = Math.round(mins / 60);
    const label = hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : `${num(hours)} ساعات`;
    return past ? `من ${label}` : `بعد ${label}`;
  }
  const days = Math.round(mins / (60 * 24));
  if (days === 1) return past ? "إمبارح" : "بكرة";
  const label = days === 2 ? "يومين" : `${num(days)} أيام`;
  return past ? `من ${label}` : `بعد ${label}`;
}

/**
 * A rating, or null.
 *
 * null when nobody has reviewed, so a card shows nothing at all rather
 * than "0.0 ★" — which reads as a terrible business instead of a new
 * one. The web removed a hardcoded 4.9 for the same reason.
 */
export function rating(avg: number | null, count: number): string | null {
  if (avg === null || count === 0) return null;
  return `${avg.toFixed(1)} (${num(count)})`;
}
