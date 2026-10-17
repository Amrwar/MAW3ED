import type { BadgeTone } from "@/design";

/**
 * What a booking's status is called, and what colour it wears.
 *
 * Both copied from the web — the labels from i18n.ts `bookingStatus`,
 * the tones from the dashboard's STATUS_STYLE — so an owner reading
 * "مؤكد" in green on a laptop sees the same word in the same green on
 * a phone. Two products disagreeing about what a status is called is
 * the kind of small wrongness that makes an app feel bolted on.
 *
 * Copied by value rather than imported for the same reason the colours
 * are: the two codebases build separately. When the web changes a
 * label, it changes here.
 */

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "مؤكد",
  PENDING: "في الانتظار",
  ARRIVED: "وصل",
  IN_PROGRESS: "جاري التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغي",
  NO_SHOW: "لم يحضر",
  PENDING_PAYMENT: "في انتظار الدفع",
  FAILED_PAYMENT: "فشل الدفع",
};

export const BOOKING_STATUS_TONE: Record<string, BadgeTone> = {
  CONFIRMED: "ok",
  PENDING: "warn",
  ARRIVED: "info",
  IN_PROGRESS: "info",
  COMPLETED: "jade",
  CANCELLED: "danger",
  NO_SHOW: "neutral",
  PENDING_PAYMENT: "warn",
  FAILED_PAYMENT: "danger",
};

const BOOKING_STATUS_LABEL_EN: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PENDING: "Awaiting confirmation",
  ARRIVED: "Checked in",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
  PENDING_PAYMENT: "Awaiting payment",
  FAILED_PAYMENT: "Payment failed",
};

/** The label in the screen's language. */
export function statusLabelFor(status: string, lang: "ar" | "en"): string {
  return (lang === "ar" ? BOOKING_STATUS_LABEL : BOOKING_STATUS_LABEL_EN)[status] ?? status;
}

/** Unknown statuses show the raw value rather than an empty badge. */
export function statusLabel(status: string): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

export function statusTone(status: string): BadgeTone {
  return BOOKING_STATUS_TONE[status] ?? "neutral";
}

