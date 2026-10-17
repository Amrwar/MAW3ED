import { ApiError, NetworkError } from "@/lib/api/errors";

/**
 * Reporting a review to Maw3ed's moderators.
 *
 * POST /api/public/reviews/[id]/report takes `{ reason, detail? }` with
 * no sign-in (the server rate-limits per device). Reporting never hides
 * the review — it goes into the moderation queue and stays visible — and
 * the answer is the same whether or not it was already reported, so the
 * app only ever says "thanks, we'll look".
 */

export type ReportReason = "INAPPROPRIATE" | "FAKE" | "SPAM" | "HARASSMENT" | "OTHER";

/** The server's reasons, in the order a person would look for them. */
export const REPORT_REASONS: { value: ReportReason; ar: string; en: string }[] = [
  { value: "INAPPROPRIATE", ar: "محتوى غير لائق", en: "Inappropriate" },
  { value: "FAKE", ar: "تقييم مزيف", en: "Fake review" },
  { value: "SPAM", ar: "سبام أو إعلان", en: "Spam or advertising" },
  { value: "HARASSMENT", ar: "إساءة أو تحرش", en: "Harassment" },
  { value: "OTHER", ar: "سبب تاني", en: "Something else" },
];

export function reportPath(reviewId: string): string {
  return `/api/public/reviews/${encodeURIComponent(reviewId)}/report`;
}

/** What a failed report says — the server's Arabic, or our English for the cases it has. */
export function reportErrorMessage(e: unknown, lang: "ar" | "en"): string {
  const ar = lang === "ar";
  if (e instanceof NetworkError) return ar ? e.message : "No connection. Try again.";
  if (e instanceof ApiError && e.status === 429) {
    return ar ? e.message : "You've reached today's limit for reports.";
  }
  if (e instanceof ApiError && ar) return e.message;
  return ar ? "ما قدرناش نبعت البلاغ. جرّب تاني." : "Couldn't send the report. Try again.";
}
