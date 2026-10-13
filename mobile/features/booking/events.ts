import { track, type AnalyticsProps } from "@/lib/analytics";

/**
 * The booking funnel, as named events — one per step a person can stop
 * at, so drop-off can be read step by step.
 *
 * Ids and categories only. No name, phone, email, note or code: the
 * analytics contract (lib/analytics.ts) forbids personal data.
 */
export type BookingEvent =
  | "booking_started"
  | "booking_resumed"
  | "booking_step_viewed"
  | "booking_service_selected"
  | "booking_staff_selected"
  | "booking_branch_selected"
  | "booking_resource_selected"
  | "booking_date_selected"
  | "booking_slots_loaded"
  | "booking_time_selected"
  | "booking_details_completed"
  | "booking_summary_viewed"
  | "booking_submitted"
  | "booking_created"
  | "booking_failed"
  | "booking_slot_conflict"
  | "booking_payment_started"
  | "booking_payment_returned"
  | "booking_confirmed"
  | "booking_awaiting_business"
  | "booking_payment_failed"
  | "booking_abandoned"
  | "booking_calendar_added"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "review_submitted";

export function trackBooking(event: BookingEvent, props: AnalyticsProps & { slug: string }) {
  track(event, props);
}
