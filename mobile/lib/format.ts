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

/**
 * Text that must read left to right inside a sentence of either
 * language — "+20", "+201012345678", "QA-1042". Without the isolate,
 * Arabic's bidi rules move the plus to the far end: "20+". A style of
 * direction: "ltr" is not enough on its own: it does not reach text
 * that shares a line with Arabic, and iOS ignores it on Text.
 */
export function isolateLtr(text: string): string {
  return `⁦${text}⁩`;
}

/**
 * A run of mixed text — a name in Latin letters next to Arabic — that
 * keeps its own direction instead of reordering the line around it
 * ("QA PushPay · 17 أكتوبر" must not become "أكتوبر QA PushPay · 17").
 * First-strong isolate: each piece reads in the direction of its first letter.
 */
export function isolate(text: string): string {
  return `⁨${text}⁩`;
}

/**
 * A phone number for display, always left to right. "+" is added only
 * to what is already international: an account's verified number is
 * stored as digits with the country code ("201012345678"), but a
 * booking's or a business's number is kept exactly as typed
 * ("01012345678", "010 1234 5678"), and "+0101…" would be a wrong
 * number. Anything else is shown as typed. Links (tel:, WhatsApp) take
 * the raw value, not this.
 */
export function formatPhone(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("+")) return isolateLtr(value);
  const international = /^20\d{10}$/.test(value) || /^[1-9]\d{10,14}$/.test(value);
  return isolateLtr(international ? `+${value}` : value);
}

/**
 * "QA PushPay · 17 أكتوبر 2:30 م": pieces joined with a middle dot, each
 * isolated so a Latin name beside Arabic text cannot pull the date
 * across it. Empty pieces are dropped; "" when nothing is left.
 */
export function joinParts(parts: readonly (string | null | undefined | false)[], lang: Lang, separator = " · "): string {
  const joined = parts
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map(isolate)
    .join(separator);
  // Isolates are invisible to the line's own direction, so with nothing
  // outside them a line would fall back to left to right. A mark of the
  // reading direction keeps the first piece at the start (the right, in Arabic).
  return joined ? `${lang === "ar" ? "‏" : "‎"}${joined}` : "";
}

/** An instant as Cairo wall-clock parts: "YYYY-MM-DD" and "HH:MM". */
function cairoParts(instant: string | Date): { date: string; hhmm: string } | null {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hhmm: `${get("hour")}:${get("minute")}` };
}

/** An instant's time of day in Cairo: "2:30 م" / "2:30 PM". */
export function instantTime(instant: string | Date, lang: Lang = "ar"): string {
  const p = cairoParts(instant);
  return p ? time(p.hhmm, lang) : "";
}

/** An instant in Cairo: "12 أكتوبر · 2:30 م" / "Oct 12 · 2:30 PM" — the app's dates and times, no seconds. */
export function dateTime(instant: string | Date, lang: Lang = "ar"): string {
  const p = cairoParts(instant);
  return p ? joinParts([shortDate(p.date, lang), time(p.hhmm, lang)], lang) : "";
}
