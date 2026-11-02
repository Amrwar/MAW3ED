import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { PHONE_INVALID } from "@/lib/phone";
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
  en = false,
): Promise<{ id: string; customerName: string; customerPhoneE164: string | null; userId: string | null }> {
  const b = await db.booking.findUnique({
    where: { accessToken: token },
    select: { id: true, customerName: true, customerPhoneE164: true },
  });
  if (!b) throw err(en ? "Booking not found" : "الحجز غير موجود", 404, { code: "not-found" });
  // A booking is not tied to an account (guests book by phone), so the
  // visitor is not either.
  return { id: b.id, customerName: b.customerName, customerPhoneE164: b.customerPhoneE164, userId: null };
}

/** Writes are limited per booking link, so one link cannot churn passes. */
export async function limitWrites(bookingId: string): Promise<void> {
  const limited = await rateLimit("accessCustomer", `booking:${bookingId}`);
  if (!limited.ok) throw tooManyRequests(limited);
}

const MESSAGES: Record<string, [number, ar: string, en: string]> = {
  "not-offered": [409, "تصاريح الدخول مش متاحة للحجز ده", "Visitor passes are not available for this booking"],
  ineligible: [409, "الحجز مش مؤهل لتصريح دخول دلوقتي", "This booking cannot have a visitor pass right now"],
  limit: [409, "وصلت لأقصى عدد مرافقين يسمح بيه المكان", "You have reached the venue's limit on guests"],
  "phone-required": [422, "المكان بيطلب رقم موبايل", "The venue needs a mobile number"],
  "not-found": [404, "مش موجود", "Not found"],
  "not-retryable": [409, "مفيش حاجة تتعاد هنا", "There is nothing to retry here"],
};

/** A visitor's details that did not pass the schema, in the caller's language. */
export function invalidVisitor(issue: { path: PropertyKey[]; code: string; message: string } | undefined, en: boolean): Response {
  if (!en) return err(issue?.message ?? "بيانات غير صالحة", 422);
  const field = issue?.path[0];
  const message =
    field === "displayName"
      ? issue?.code === "too_big" ? "The name is too long (80 characters at most)" : "Enter a name (at least 2 characters)"
      : field === "phone"
        ? issue?.code === "too_big" ? "The mobile number is too long" : "Enter a valid mobile number"
        : "Those details are not valid";
  return err(message, 422);
}

/** PHONE_INVALID, in the caller's language. */
export function invalidPhone(en: boolean): Response {
  return err(en ? "That mobile number is not valid — include the country code, e.g. +20 10 1234 5678" : PHONE_INVALID, 422, { code: "phone-invalid" });
}

/** The answer for a refused pass action, with the reason in words. */
export function refusal(r: Extract<AccessActionResult, { ok: false }>, en = false): Response {
  const [status, ar, english] = MESSAGES[r.code] ?? [409, "مش متاح", "Not available"];
  const message = en ? english : ar;
  const reason = r.reason ? REASON_TEXT[r.reason]?.[en ? 1 : 0] ?? null : null;
  return err(reason ?? message, status, { code: r.code, reason: r.reason ?? null });
}

/** The common catch for these routes. */
export function failure(tag: string, e: unknown, log: { error: (m: string, e: unknown) => void }, en = false): Response {
  if (e instanceof Response) return e;
  log.error(tag, e);
  return err(en ? "Something went wrong on our side. Try again shortly." : "حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
}
