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

/* Why a whole day cannot be booked (lib/bookings/availability UnavailableReason): another time that day will not do. */
const DAY_UNAVAILABLE_EN: Record<string, string> = {
  past: "That date has passed. Choose another date.",
  "too-far-ahead": "That date is too far ahead to book. Choose an earlier date.",
  "same-day-cutoff": "It's too late to book for today. Choose another date.",
  "business-closed": "The place is closed that day. Choose another date.",
  "venue-closed": "The venue is closed that day. Choose another date.",
  "staff-off": "Your provider isn't working that day. Choose another date.",
  holiday: "The place is closed for a holiday that day. Choose another date.",
  vacation: "Your provider is away that day. Choose another date.",
};

/**
 * The cancel and reschedule routes' refusals in English, from the code
 * (and details) they send. The routes answer in Arabic, and the app uses
 * them too, so the booking page words them here; null for a code this
 * does not know, which then falls to refusalText.
 */
export function bookingRefusalEn(body: { code?: unknown; reason?: unknown; cutoffHours?: unknown } | null, action: "cancel" | "change"): string | null {
  const data = body ?? {};
  const hours = typeof data.cutoffHours === "number" ? `${data.cutoffHours} hour${data.cutoffHours === 1 ? "" : "s"}` : null;
  switch (data.code) {
    case "not-found": return "Booking not found.";
    case "not-cancellable": return "This booking can't be cancelled.";
    case "not-changeable": return "This booking's time can't be changed.";
    case "too-late":
      return `It's too close to the appointment to ${action} it online${hours ? ` (the limit is ${hours} before)` : ""}. Contact the place.`;
    case "invalid": return "Choose a date and a time.";
    case "slot-unavailable":
      return (typeof data.reason === "string" && DAY_UNAVAILABLE_EN[data.reason]) || "That time isn't available. Choose another.";
    case "slot-taken": return "Someone just booked that time. Choose another.";
    case "changed": return "The booking just changed. Refresh the page and try again.";
    default: return null;
  }
}

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
