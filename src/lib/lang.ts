/** The cookie the language switch writes: the visitor's saved choice. */
export const LANG_COOKIE = "maw3ed-lang";

/** How long the choice is kept: a year, in seconds. */
export const LANG_COOKIE_MAX_AGE = 31536000;

/**
 * The request header carrying the language the proxy resolved for this
 * request (src/proxy.ts). Set on every request, so it is never one the
 * client sent.
 */
export const LANG_HEADER = "x-maw3ed-lang";

/**
 * Whether an API request asked for English (?lang=en). The web screens
 * and the app both ask this way; Arabic is the default.
 */
export function isEnglish(req: Request): boolean {
  return new URL(req.url).searchParams.get("lang") === "en";
}

/** A name in the chosen language: the Arabic one when there is no English (missing or blank). */
export function localName(en: boolean, nameAr: string, nameEn: string | null | undefined): string {
  return (en && nameEn?.trim()) || nameAr;
}

const ARABIC = /[\u0600-\u06FF]/;

/**
 * A refused request's message for the screen. The access routes word
 * their own errors in English when asked, but shared pieces (sign-in
 * and role guards, the rate limiter) answer in Arabic, so an English
 * screen words those by status instead.
 */
export function refusalText(status: number, error: unknown, en: boolean, arFallback: string): string {
  const text = typeof error === "string" && error ? error : null;
  if (!en) return text ?? arFallback;
  if (text && !ARABIC.test(text)) return text;
  if (status === 401) return "Sign in again.";
  if (status === 403) return "Your account may not do this.";
  if (status === 404) return "Not found, or you no longer have access here.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  return "Something went wrong. Try again.";
}
