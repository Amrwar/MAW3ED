import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { REASON_TEXT } from "./eligibility";
import type { AccessActionResult } from "./passes";

/**
 * What the customer's access routes (/api/booking/:token/access/*) share.
 * The manage link (Booking.accessToken) is the credential, as for the
 * booking's own cancel and reschedule.
 */

/** The booking a manage link stands for, or a 404 Response thrown. */
export async function bookingForToken(
  token: string,
): Promise<{ id: string; customerName: string; customerPhoneE164: string | null; userId: string | null }> {
  const b = await db.booking.findUnique({
    where: { accessToken: token },
    select: { id: true, customerName: true, customerPhoneE164: true },
  });
  if (!b) throw err("الحجز غير موجود", 404, { code: "not-found" });
  // A booking is not tied to an account (guests book by phone), so the
  // visitor is not either.
  return { id: b.id, customerName: b.customerName, customerPhoneE164: b.customerPhoneE164, userId: null };
}

/** Writes are limited per booking link, so one link cannot churn passes. */
export async function limitWrites(bookingId: string): Promise<void> {
  const limited = await rateLimit("accessCustomer", `booking:${bookingId}`);
  if (!limited.ok) throw tooManyRequests(limited);
}

export function isEnglish(req: Request): boolean {
  return new URL(req.url).searchParams.get("lang") === "en";
}

const MESSAGES: Record<string, [number, string]> = {
  "not-offered": [409, "تصاريح الدخول مش متاحة للحجز ده"],
  ineligible: [409, "الحجز مش مؤهل لتصريح دخول دلوقتي"],
  limit: [409, "وصلت لأقصى عدد مرافقين يسمح بيه المكان"],
  "phone-required": [422, "المكان بيطلب رقم موبايل"],
  "not-found": [404, "مش موجود"],
  "not-retryable": [409, "مفيش حاجة تتعاد هنا"],
};

/** The answer for a refused pass action, with the reason in words. */
export function refusal(r: Extract<AccessActionResult, { ok: false }>): Response {
  const [status, message] = MESSAGES[r.code] ?? [409, "مش متاح"];
  const reason = r.reason ? REASON_TEXT[r.reason]?.[0] ?? null : null;
  return err(reason ?? message, status, { code: r.code, reason: r.reason ?? null });
}

/** The common catch for these routes. */
export function failure(tag: string, e: unknown, log: { error: (m: string, e: unknown) => void }): Response {
  if (e instanceof Response) return e;
  log.error(tag, e);
  return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
}
