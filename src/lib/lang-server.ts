import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

/** The cookie the language switch writes (LanguageContext). */
export const LANG_COOKIE = "maw3ed-lang";

/**
 * The language this request is served in: the visitor's own choice,
 * else Arabic.
 *
 * Deliberately not Accept-Language. Both languages share one URL, so
 * whatever a crawler is served is what that URL is indexed as — and a
 * crawler that announced English would have turned the Arabic site into
 * an English one in search results. Arabic is the product's language;
 * English is one tap away and remembered.
 */
export async function getLang(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "en" ? "en" : "ar";
}
