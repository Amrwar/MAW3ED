import type { BadgeTone } from "@/design";
import type { BookingStatus, PublicBooking } from "@/types/api";

/**
 * What a booking's server-side state means to the person who just made
 * it — and so what the result screen may say.
 *
 * "Confirmed" is said only for CONFIRMED (or later, in the chair). A
 * booking the business still has to accept is received, not confirmed;
 * one waiting on a deposit is held, not confirmed. The app never
 * upgrades a status on its own — a payment redirect, a create response
 * or a timer cannot make a booking confirmed; only this read can.
 */

export type Outcome =
  | "confirmed"
  | "awaiting-business"
  | "awaiting-payment"
  | "payment-failed"
  | "cancelled"
  | "finished";

export function outcomeOf(status: BookingStatus): Outcome {
  switch (status) {
    case "CONFIRMED":
    case "ARRIVED":
    case "IN_PROGRESS":
      return "confirmed";
    case "PENDING":
      return "awaiting-business";
    case "PENDING_PAYMENT":
      return "awaiting-payment";
    case "FAILED_PAYMENT":
      return "payment-failed";
    case "CANCELLED":
      return "cancelled";
    case "COMPLETED":
    case "NO_SHOW":
      return "finished";
  }
}

export const OUTCOME_TONE: Record<Outcome, BadgeTone> = {
  confirmed: "ok",
  "awaiting-business": "warn",
  "awaiting-payment": "warn",
  "payment-failed": "danger",
  cancelled: "danger",
  finished: "neutral",
};

type Lang = "ar" | "en";
const T = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);

export function outcomeCopy(outcome: Outcome, lang: Lang, b: Pick<PublicBooking, "payment">): { title: string; body: string } {
  switch (outcome) {
    case "confirmed":
      return {
        title: T(lang, "حجزك اتأكد", "Your booking is confirmed"),
        body: T(lang, "هنفكّرك قبل الميعاد.", "We'll remind you before your appointment."),
      };
    case "awaiting-business":
      return {
        title: T(lang, "طلبك وصل", "Booking request received"),
        body: T(lang, "المكان هيراجع الحجز ويأكده. هيوصلك إشعار أول ما يأكدوا.", "The business will review and confirm it. You'll be notified as soon as they do."),
      };
    case "awaiting-payment":
      return b.payment?.status === "FAILED"
        ? {
            title: T(lang, "الدفع مانجحش", "Payment didn't go through"),
            body: T(lang, "الميعاد لسه محجوز لك شوية. جرّب تدفع تاني.", "Your time is still held for a short while. Try paying again."),
          }
        : {
            title: T(lang, "مستنيين تأكيد الدفع", "Waiting for payment confirmation"),
            body: T(
              lang,
              "الميعاد محجوز لك لحد ما الدفع يتأكد. لو دفعت، التأكيد بيوصل خلال ثواني.",
              "Your time is held until the deposit is confirmed. If you've paid, this usually takes a few seconds.",
            ),
          };
    case "payment-failed":
      return {
        title: T(lang, "الدفع ماكملش", "Payment wasn't completed"),
        body: T(lang, "الحجز ماتأكدش ومفيش فلوس اتخصمت. تقدر تحجز من جديد.", "The booking wasn't confirmed and the deposit wasn't taken. You can book again."),
      };
    case "cancelled":
      return {
        title: T(lang, "الحجز ده اتلغى", "This booking was cancelled"),
        body: T(lang, "تقدر تحجز ميعاد تاني في أي وقت.", "You can book another time whenever you like."),
      };
    case "finished":
      return {
        title: T(lang, "الميعاد ده خلص", "This appointment has passed"),
        body: "",
      };
  }
}

/** Keep asking while the answer can still change by itself — a webhook on its way. */
export function shouldPoll(status: BookingStatus | undefined): boolean {
  return status === "PENDING_PAYMENT";
}

const CHANNEL_NAME: Record<PublicBooking["notifications"][number]["channel"], { ar: string; en: string }> = {
  IN_APP: { ar: "إشعار في التطبيق", en: "In-app" },
  PUSH: { ar: "إشعار على الموبايل", en: "Push notification" },
  WHATSAPP: { ar: "واتساب", en: "WhatsApp" },
  EMAIL: { ar: "إيميل", en: "Email" },
  SMS: { ar: "رسالة SMS", en: "SMS" },
};

/** "WhatsApp sent", "Email failed" — only what the server recorded, never a promise. */
export function notificationLines(list: PublicBooking["notifications"], lang: Lang): { label: string; ok: boolean }[] {
  return list
    .filter((n) => n.status !== "SKIPPED")
    .map((n) => ({
      label: `${CHANNEL_NAME[n.channel][lang]} — ${n.status === "SENT" ? T(lang, "اتبعت", "sent") : T(lang, "ماوصلش", "not delivered")}`,
      ok: n.status === "SENT",
    }));
}
