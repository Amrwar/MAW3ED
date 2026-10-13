import type { Lang } from "@/lib/format";
import type { Available, MinRating, Sort } from "./searchState";

/** What each sort, availability and rating choice is called, in both languages. */

const SORT: Record<Sort, [ar: string, en: string]> = {
  recommended: ["الأنسب", "Recommended"],
  soonest: ["أقرب موعد فاضي", "Soonest available"],
  rating: ["الأعلى تقييماً", "Top rated"],
  "most-booked": ["الأكثر حجزاً", "Most booked"],
  "price-asc": ["السعر: الأقل أولاً", "Price: low to high"],
  "price-desc": ["السعر: الأعلى أولاً", "Price: high to low"],
};

const AVAILABLE: Record<Available, [ar: string, en: string]> = {
  any: ["أي وقت", "Any time"],
  // The API checks opening hours, not free slots, so they are named for that.
  today: ["مفتوح النهارده", "Open today"],
  tomorrow: ["مفتوح بكرة", "Open tomorrow"],
  "open-now": ["مفتوح دلوقتي", "Open now"],
};

export const sortLabel = (s: Sort, lang: Lang) => SORT[s][lang === "ar" ? 0 : 1];
export const availableLabel = (a: Available, lang: Lang) => AVAILABLE[a][lang === "ar" ? 0 : 1];

export function ratingLabel(r: MinRating, lang: Lang): string {
  if (r === 0) return lang === "ar" ? "أي تقييم" : "Any rating";
  return lang === "ar" ? `${r}+ نجوم` : `${r}+ stars`;
}

export function priceLabel(min: number | null, max: number | null, lang: Lang): string | null {
  const ar = lang === "ar";
  const cur = ar ? "ج.م" : "EGP";
  if (min !== null && max !== null) return ar ? `${min}–${max} ${cur}` : `${cur} ${min}–${max}`;
  if (min !== null) return ar ? `من ${min} ${cur}` : `From ${cur} ${min}`;
  if (max !== null) return ar ? `لحد ${max} ${cur}` : `Up to ${cur} ${max}`;
  return null;
}
