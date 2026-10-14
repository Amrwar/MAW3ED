import type { Lang } from "@/lib/i18n";

/**
 * Number, money, date and time formatting for Maw3ed.
 *
 * The whole app must go through here. The reason is the numeral
 * system: plain `toLocaleString("ar-EG")` renders Arabic-Indic
 * digits (٣٠٠), which Egyptian users do not read in apps — a price
 * shown that way looks like a rendering fault rather than a price.
 * The `-u-nu-latn` extension keeps Arabic month and day names while
 * giving Western digits.
 */

const AR_LATN = "ar-EG-u-nu-latn";
const EN = "en-US";

export function localeFor(lang: Lang): string {
  return lang === "en" ? EN : AR_LATN;
}

/* ─── Numbers ────────────────────────────────────────────── */

export function num(value: number, lang: Lang = "ar"): string {
  return value.toLocaleString(localeFor(lang));
}

export function percent(value: number, lang: Lang = "ar"): string {
  return `${Math.round(value).toLocaleString(localeFor(lang))}%`;
}

/* ─── Money ──────────────────────────────────────────────── */

const CURRENCY_LABEL: Record<string, { ar: string; en: string }> = {
  EGP: { ar: "ج.م", en: "EGP" },
  USD: { ar: "دولار", en: "USD" },
  SAR: { ar: "ريال", en: "SAR" },
  AED: { ar: "درهم", en: "AED" },
};

export function currencyLabel(currency = "EGP", lang: Lang = "ar"): string {
  return CURRENCY_LABEL[currency]?.[lang] ?? currency;
}

export function money(
  value: number,
  lang: Lang = "ar",
  currency = "EGP",
): string {
  return `${moneyFigure(value, lang)} ${currencyLabel(currency, lang)}`;
}

/**
 * A whole amount as it is ("300"); anything with piastres always to two
 * places ("37.50", never "37.5"), the way a price is written.
 */
function moneyFigure(value: number, lang: Lang): string {
  const cents = Math.round(value * 100);
  if (cents % 100 === 0) return num(cents / 100, lang);
  return (cents / 100).toLocaleString(localeFor(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ─── Duration ───────────────────────────────────────────── */

export function duration(minutes: number, lang: Lang = "ar"): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (lang === "en") {
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h} hr`;
    return `${h} hr ${m} min`;
  }

  const hourWord = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : h <= 10 ? "ساعات" : "ساعة";
  const mins = `${num(m, lang)} ${m >= 3 && m <= 10 ? "دقايق" : "دقيقة"}`;
  if (h === 0) return mins;
  if (m === 0) return h <= 2 ? hourWord : `${num(h, lang)} ${hourWord}`;
  const hPart = h <= 2 ? hourWord : `${num(h, lang)} ${hourWord}`;
  return `${hPart} و${mins}`;
}

/* ─── Dates & times ──────────────────────────────────────── */

function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "الخميس 9 أكتوبر" / "Thursday 9 October" */
export function dateLong(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "9 أكتوبر" / "9 Oct" */
export function dateShort(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), {
    day: "numeric",
    month: lang === "en" ? "short" : "long",
  });
}

/** "9 أكتوبر 2026" */
export function dateFull(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Weekday only — "الخميس" */
export function weekday(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), { weekday: "long" });
}

/** Short weekday — "خميس" / "Thu" */
export function weekdayShort(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), { weekday: "short" });
}

/** Day of month as a bare number — "9" */
export function dayNum(value: Date | string | number, lang: Lang = "ar"): string {
  return asDate(value).toLocaleDateString(localeFor(lang), { day: "numeric" });
}

/** 24-hour clock — "11:30". Always Western digits, always LTR. */
export function time(value: Date | string | number): string {
  const d = asDate(value);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "11:30 — 12:15" */
export function timeRange(
  start: Date | string | number,
  end: Date | string | number,
): string {
  return `${time(start)} — ${time(end)}`;
}

/** Normalises an "HH:MM" or "H:MM" string to "HH:MM". */
export function clock(value: string): string {
  const [h = "0", m = "00"] = value.split(":");
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/* ─── Relative time ──────────────────────────────────────── */

/** "النهاردة" · "قبل 3 أيام" · "بعد ساعتين" */
export function relative(value: Date | string | number, lang: Lang = "ar"): string {
  const then = asDate(value).getTime();
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  if (abs < MIN) return lang === "en" ? "just now" : "دلوقتي";

  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: "auto" });

  if (abs < HOUR) return rtf.format(Math.round(diffMs / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diffMs / HOUR), "hour");
  if (abs < 30 * DAY) return rtf.format(Math.round(diffMs / DAY), "day");
  if (abs < 365 * DAY) return rtf.format(Math.round(diffMs / (30 * DAY)), "month");
  return rtf.format(Math.round(diffMs / (365 * DAY)), "year");
}

/** Whole days between now and a date, rounded up. Negative = past. */
export function daysUntil(value: Date | string | number, now: number): number {
  return Math.ceil((asDate(value).getTime() - now) / (24 * 60 * 60 * 1000));
}

/* ─── Ratings & counts ───────────────────────────────────── */

/** "4.8" — one decimal, Western digits, never localised. */
export function rating(value: number): string {
  return value.toFixed(1);
}

/** Arabic plurals are not an "s" — this picks the right word. */
export function plural(
  count: number,
  forms: { zero?: string; one: string; two: string; few: string; many: string },
): string {
  if (count === 0) return forms.zero ?? forms.many;
  if (count === 1) return forms.one;
  if (count === 2) return forms.two;
  if (count % 100 >= 3 && count % 100 <= 10) return forms.few;
  return forms.many;
}

/** "3 حجوزات" / "3 bookings" */
export function countLabel(
  count: number,
  lang: Lang,
  ar: { zero?: string; one: string; two: string; few: string; many: string },
  en: { one: string; other: string },
): string {
  if (lang === "en") {
    return `${count.toLocaleString(EN)} ${count === 1 ? en.one : en.other}`;
  }
  const word = plural(count, ar);
  // "حجز واحد" and "حجزان" already carry the number in the word
  if (count === 1 || count === 2) return word;
  return `${num(count, lang)} ${word}`;
}

/** The four Arabic forms of a counted noun. `one` and `two` are whole
 *  phrases ("مكان واحد", "مكانين"); `few` (3–10) and `many` (11+) are
 *  the bare noun, which gets the number in front of it. */
export interface ArCountForms {
  zero?: string;
  one: string;
  two: string;
  few: string;
  many: string;
}

/**
 * One counted noun, Arabic rules:
 *   arCount(1, f) → "مكان واحد" · arCount(2, f) → "مكانين"
 *   arCount(5, f) → "5 أماكن"   · arCount(15, f) → "15 مكان"
 * (101–102 behave like 11+, 103–110 like 3–10, as Arabic does.)
 */
export function arCount(count: number, forms: ArCountForms): string {
  const word = plural(count, forms);
  if (count === 1 || count === 2) return word;
  return `${num(count, "ar")} ${word}`;
}

/** "1 booking" / "3 bookings". `other` defaults to `one` + "s". */
export function enCount(count: number, one: string, other = `${one}s`): string {
  return `${count.toLocaleString(EN)} ${count === 1 ? one : other}`;
}

/** Either language: arCount in Arabic, enCount in English. */
export function countIn(
  lang: Lang,
  count: number,
  ar: ArCountForms,
  en: { one: string; other?: string },
): string {
  return lang === "en" ? enCount(count, en.one, en.other) : arCount(count, ar);
}

/* ─── Phone ──────────────────────────────────────────────── */

/** Egyptian mobile numbers display unformatted and LTR. */
export function phone(value: string): string {
  return value.replace(/\s+/g, "");
}
