import type { Lang } from "@/lib/i18n";

/** ?lang=en or ?lang=ar on a legal page; anything else means "follow the site". */
export function parseLangParam(v: string | string[] | undefined): Lang | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "en" || s === "ar" ? s : undefined;
}
