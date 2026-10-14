/**
 * Numbers, money, dates and times, formatted the way the web formats
 * them (src/lib/fmt.ts).
 *
 * Arabic is "ar-EG-u-nu-latn": Arabic month and day names with Latin
 * digits. Egyptian users read prices and times in 1234, not ١٢٣٤, and
 * the web settled on this after the same question came up there. One
 * decision, both products.
 *
 * Every function takes the language last and defaults to Arabic, the
 * product's language, so screens written before English existed keep
 * working unchanged. New code passes `lang` from useLocale().
 */

import { count } from "./plural";

export type Lang = "ar" | "en";

export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-US" : "ar-EG-u-nu-latn";
}

/** A count. Never used for money — that needs the currency. */
export function num(value: number, lang: Lang = "ar"): string {
  return new Intl.NumberFormat(localeFor(lang)).format(value);
}

const CURRENCY: Record<string, Record<Lang, string>> = {
  EGP: { ar: "ج.م", en: "EGP" },
};

/**
 * A price. null for null, so a caller has to decide what "no price set"
 * looks like rather than being handed "0 ج.م". A service priced by
 * arrangement is not a free service, and the web had to remove exactly
 * that bug.
 */
export function money(value: number | null, currency = "EGP", lang: Lang = "ar"): string | null {
  if (value === null) return null;
  // Whole pounds without decimals; anything else to the piastre, always
  // two places — "462.50", never "462.5".
  const decimals = value % 1 === 0 ? 0 : 2;
  const formatted = new Intl.NumberFormat(localeFor(lang), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  const label = CURRENCY[currency]?.[lang] ?? currency;
  return lang === "en" ? `${label} ${formatted}` : `${formatted} ${label}`;
}

/** "45 دقيقة", "ساعة و15 دقيقة" / "1 hr 15 min". Minutes are clearer than "ساعة ونص". */
export function duration(minutes: number, lang: Lang = "ar"): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (lang === "en") {
    if (hours === 0) return `${rest} min`;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
  }
  if (minutes < 60) return count(minutes, "minute", "ar");
  const hoursPart = count(hours, "hour", "ar");
  return rest ? `${hoursPart} و${count(rest, "minute", "ar")}` : hoursPart;
}

/**
 * A "YYYY-MM-DD" as a Date at UTC midnight. Formatted in UTC on purpose:
 * a date string carries no timezone, and formatting UTC midnight in a
 * timezone behind UTC prints the day before. Everything in this product
 * is a Cairo calendar day; the phone's own timezone must not move it.
 */
function day(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}

function fmt(isoDate: string, lang: Lang, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeFor(lang), { ...options, timeZone: "UTC" }).format(day(isoDate));
}

/** "الأحد 12 أكتوبر" / "Sunday, October 12". */
export function longDate(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { weekday: "long", day: "numeric", month: "long" });
}

/** "12 أكتوبر" / "Oct 12" — for lists, where the weekday is noise. */
export function shortDate(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { day: "numeric", month: "short" });
}

/** "الأحد" / "Sun". Whole names in Arabic: three letters of الأحد and الأربعاء are both "الأ". */
export function weekdayShort(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { weekday: lang === "en" ? "short" : "long" });
}

/**
 * Calendar column headings: one letter in Arabic (ح ن ث ر خ ج س — the
 * standard abbreviation, and unambiguous, unlike three-letter prefixes
 * where الأحد and الأربعاء are both "الأ"), "Sun" in English.
 */
export function weekdayHeading(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { weekday: lang === "en" ? "short" : "narrow" });
}

/** "أكتوبر" / "Oct". */
export function monthShort(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { month: lang === "en" ? "short" : "long" });
}

/** "12". */
export function dayOfMonth(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { day: "numeric" });
}

/** "أكتوبر 2026" / "October 2026". */
export function monthYear(isoDate: string, lang: Lang = "ar"): string {
  return fmt(isoDate, lang, { month: "long", year: "numeric" });
}

/** "14:30" to "2:30 م" / "2:30 PM". */
export function time(hhmm: string, lang: Lang = "ar"): string {
  const [h, m] = hhmm.split(":").map(Number);
  // A malformed value is returned as-is rather than rendered as
  // "NaN:NaN". It comes from the database, so it should not happen —
  // but a clock that reads NaN is worse than one that reads oddly.
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const period = lang === "en" ? (h < 12 ? "AM" : "PM") : h < 12 ? "ص" : "م";
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * "بعد ساعتين", "بكرة", "من 3 أيام" / "in 2 hours", "tomorrow".
 *
 * Takes the minutesUntil the server already computed, rather than
 * comparing against the device clock — a phone with the wrong time
 * would otherwise show an appointment as missed.
 */
export function relativeTime(minutesUntil: number, lang: Lang = "ar"): string {
  const past = minutesUntil < 0;
  const mins = Math.abs(minutesUntil);

  if (lang === "en") {
    const say = (n: number, unit: string) => {
      const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
      return past ? `${label} ago` : `in ${label}`;
    };
    if (mins < 60) return say(Math.max(1, Math.round(mins)), "minute");
    if (mins < 60 * 24) return say(Math.round(mins / 60), "hour");
    const days = Math.round(mins / (60 * 24));
    if (days === 1) return past ? "yesterday" : "tomorrow";
    return say(days, "day");
  }

  if (mins < 60) {
    const label = count(Math.max(1, Math.round(mins)), "minute", "ar");
    return past ? `من ${label}` : `بعد ${label}`;
  }
  if (mins < 60 * 24) {
    const hours = Math.round(mins / 60);
    const label = count(hours, "hour", "ar");
    return past ? `من ${label}` : `بعد ${label}`;
  }
  const days = Math.round(mins / (60 * 24));
  if (days === 1) return past ? "إمبارح" : "بكرة";
  const label = count(days, "day", "ar");
  return past ? `من ${label}` : `بعد ${label}`;
}

/**
 * A rating, or null.
 *
 * null when nobody has reviewed, so a card shows nothing at all rather
 * than "0.0 ★" — which reads as a terrible business instead of a new
 * one. The web removed a hardcoded 4.9 for the same reason.
 */
export function rating(avg: number | null, count: number, lang: Lang = "ar"): string | null {
  if (avg === null || count === 0) return null;
  return `${avg.toFixed(1)} (${num(count, lang)})`;
}
