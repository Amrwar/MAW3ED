import type { BadgeTone } from "@/components/ui/Badge";

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

/** Unknown statuses show the raw value rather than an empty badge. */
export function statusLabel(status: string): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

export function statusTone(status: string): BadgeTone {
  return BOOKING_STATUS_TONE[status] ?? "neutral";
}

/**
 * What an owner can do to a booking next.
 *
 * These mirror VALID_TRANSITIONS in
 * src/app/api/business/bookings/[id]/route.ts, and booking-transitions
 * .test.ts fails if the two lists drift.
 *
 * They were briefly wrong in both directions. First this file offered
 * ARRIVED and IN_PROGRESS when the API refused them, so two of five
 * buttons returned 422. Then they were removed from here — which was
 * the wrong half to change, because the states exist in BookingStatus,
 * are labelled in both languages and are counted by booking_no_overlap.
 * The API accepts them now, so the day-of path is offered again.
 *
 * COMPLETED stays available straight from CONFIRMED: an owner marking a
 * finished appointment should not have to walk through two intermediate
 * states first.
 *
 * A finished or cancelled appointment offers nothing — there is no
 * forward move from either, and greyed-out buttons invite people to
 * press them.
 */
export function nextActionsFor(status: string): { status: string; label: string }[] {
  switch (status) {
    case "PENDING_PAYMENT":
      return [{ status: "CANCELLED", label: "ألغِ" }];
    case "PENDING":
      return [
        { status: "CONFIRMED", label: "أكّد" },
        { status: "CANCELLED", label: "ألغِ" },
      ];
    case "CONFIRMED":
      return [
        { status: "ARRIVED", label: "وصل" },
        { status: "COMPLETED", label: "خلص" },
        { status: "NO_SHOW", label: "لم يحضر" },
        { status: "CANCELLED", label: "ألغِ" },
      ];
    case "ARRIVED":
      return [
        { status: "IN_PROGRESS", label: "ابدأ" },
        { status: "COMPLETED", label: "خلص" },
      ];
    case "IN_PROGRESS":
      return [{ status: "COMPLETED", label: "خلص" }];
    default:
      return [];
  }
}
