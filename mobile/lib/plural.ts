import { num, type Lang } from "./format";

/**
 * A count with its noun, agreeing in both languages.
 *
 * Arabic counts have four shapes, and getting them wrong is the first
 * thing a reader notices ("٣ مكان", "٢ أشخاص"):
 *
 *   1      the noun alone, or with واحد/واحدة   مكان واحد
 *   2      the dual, no number                 مكانين
 *   3–10   number + plural                     ٣ أماكن
 *   11+    number + singular                   ١١ مكان
 *
 * Past 100 the last two digits decide (103 أماكن, 111 مكان, 100 مكان).
 * Zero takes the plural. English is "1 place" / "2 places".
 */

export interface Noun {
  ar: { one: string; two: string; few: string; many: string };
  en: { one: string; other: string };
}

export const NOUNS = {
  place: { ar: { one: "مكان واحد", two: "مكانين", few: "أماكن", many: "مكان" }, en: { one: "place", other: "places" } },
  booking: { ar: { one: "حجز واحد", two: "حجزين", few: "حجوزات", many: "حجز" }, en: { one: "booking", other: "bookings" } },
  person: { ar: { one: "شخص واحد", two: "شخصين", few: "أشخاص", many: "شخص" }, en: { one: "person", other: "people" } },
  service: { ar: { one: "خدمة واحدة", two: "خدمتين", few: "خدمات", many: "خدمة" }, en: { one: "service", other: "services" } },
  branch: { ar: { one: "فرع واحد", two: "فرعين", few: "فروع", many: "فرع" }, en: { one: "branch", other: "branches" } },
  table: { ar: { one: "ترابيزة واحدة", two: "ترابيزتين", few: "ترابيزات", many: "ترابيزة" }, en: { one: "table", other: "tables" } },
  review: { ar: { one: "تقييم واحد", two: "تقييمين", few: "تقييمات", many: "تقييم" }, en: { one: "review", other: "reviews" } },
  device: { ar: { one: "جهاز واحد", two: "جهازين", few: "أجهزة", many: "جهاز" }, en: { one: "device", other: "devices" } },
  attempt: { ar: { one: "محاولة واحدة", two: "محاولتين", few: "محاولات", many: "محاولة" }, en: { one: "attempt", other: "attempts" } },
  // Units read without واحد: "بعد دقيقة", "ساعة و15 دقيقة".
  minute: { ar: { one: "دقيقة", two: "دقيقتين", few: "دقايق", many: "دقيقة" }, en: { one: "minute", other: "minutes" } },
  hour: { ar: { one: "ساعة", two: "ساعتين", few: "ساعات", many: "ساعة" }, en: { one: "hour", other: "hours" } },
  day: { ar: { one: "يوم", two: "يومين", few: "أيام", many: "يوم" }, en: { one: "day", other: "days" } },
} satisfies Record<string, Noun>;

export type NounKey = keyof typeof NOUNS;

/** Which of the four Arabic shapes a count takes. */
export function arabicForm(n: number): "one" | "two" | "few" | "many" {
  if (n === 1) return "one";
  if (n === 2) return "two";
  const r = n > 100 ? n % 100 : n;
  if (n === 0 || (r >= 3 && r <= 10)) return "few";
  return "many";
}

/** "٣ أماكن" / "3 places"; "مكانين" / "2 places"; "مكان واحد" / "1 place". */
export function count(n: number, noun: NounKey | Noun, lang: Lang): string {
  const w = typeof noun === "string" ? NOUNS[noun] : noun;
  if (lang === "en") return `${num(n, "en")} ${n === 1 ? w.en.one : w.en.other}`;
  const form = arabicForm(n);
  if (form === "one" || form === "two") return w.ar[form];
  return `${num(n, "ar")} ${w.ar[form]}`;
}


/** A notice period given in hours: "يومين" / "2 days" when whole days, else "٣ ساعات" / "3 hours". */
export function hoursSpan(hours: number, lang: Lang): string {
  return hours >= 24 && hours % 24 === 0 ? count(hours / 24, "day", lang) : count(hours, "hour", lang);
}

/**
 * Just the noun, for a count drawn on its own — a big "3" with
 * "حجوزات" / "bookings" under it. No dual or واحد: the figure is right
 * there, so 1, 2 and 11+ take the singular and 3–10 (and 0) the plural.
 */
export function unitFor(n: number, noun: NounKey, lang: Lang): string {
  const w = NOUNS[noun];
  if (lang === "en") return n === 1 ? w.en.one : w.en.other;
  return arabicForm(n) === "few" ? w.ar.few : w.ar.many;
}
