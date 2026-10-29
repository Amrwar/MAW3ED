/**
 * The booking state machine, in one place.
 *
 * Every route that moves a booking used to carry its own table of what
 * may follow what — the owner's PATCH, the dashboard's buttons, the
 * customer's cancel, the webhook — and they had drifted. This is the
 * one table; the dashboard imports it, the API checks it, and
 * lib/bookings/state.ts makes the move itself conditional on the
 * status it was decided from, so two moves racing cannot both apply.
 *
 * Pure: no database, so the client bundle can import it.
 *
 *   PENDING_PAYMENT  holding its time while the deposit is paid
 *   PENDING          waiting for the business to confirm
 *   CONFIRMED        the appointment stands
 *   ARRIVED          the customer is in the building
 *   IN_PROGRESS      being served
 *   COMPLETED        done                                  (terminal)
 *   CANCELLED        called off by either side             (terminal)
 *   NO_SHOW          the customer never came               (terminal)
 *   FAILED_PAYMENT   the deposit did not arrive; time released
 */

export const BOOKING_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "FAILED_PAYMENT",
] as const;

export type BookingStatusValue = (typeof BOOKING_STATUSES)[number];

/** Who is asking for the move. */
export type Mover = "business" | "customer" | "system";

/** Statuses that still hold their time (mirrors the exclusion constraints). */
export const LIVE_STATUSES: readonly BookingStatusValue[] = [
  "PENDING_PAYMENT",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
];

/** Nothing moves out of these by hand. */
export const TERMINAL_STATUSES: readonly BookingStatusValue[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

/**
 * What the business may do from each status, in the order the buttons
 * are shown. PENDING_PAYMENT has no "confirm": the money confirms it
 * (the webhook, or cash recorded at the counter). COMPLETED stays
 * reachable straight from CONFIRMED so a busy owner need not walk
 * through ARRIVED and IN_PROGRESS first.
 */
export const BUSINESS_TRANSITIONS: Readonly<Record<BookingStatusValue, readonly BookingStatusValue[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["ARRIVED", "IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  FAILED_PAYMENT: [],
};

/** What the customer may do from their own link (time cutoffs aside; see self-service.ts). */
export const CUSTOMER_TRANSITIONS: Readonly<Record<BookingStatusValue, readonly BookingStatusValue[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PENDING: ["CANCELLED"],
  CONFIRMED: ["CANCELLED"],
  ARRIVED: [],
  IN_PROGRESS: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  FAILED_PAYMENT: [],
};

/**
 * What the system does on its own: money arriving or not, cash at the
 * counter, the reaper, a late payment reviving a released hold if its
 * time is still free.
 */
export const SYSTEM_TRANSITIONS: Readonly<Record<BookingStatusValue, readonly BookingStatusValue[]>> = {
  PENDING_PAYMENT: ["PENDING", "CONFIRMED", "FAILED_PAYMENT", "CANCELLED"],
  PENDING: [],
  CONFIRMED: [],
  ARRIVED: [],
  IN_PROGRESS: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  FAILED_PAYMENT: ["CONFIRMED"],
};

const TABLES: Record<Mover, Readonly<Record<BookingStatusValue, readonly BookingStatusValue[]>>> = {
  business: BUSINESS_TRANSITIONS,
  customer: CUSTOMER_TRANSITIONS,
  system: SYSTEM_TRANSITIONS,
};

export function isBookingStatus(value: string): value is BookingStatusValue {
  return (BOOKING_STATUSES as readonly string[]).includes(value);
}

/** Whether `by` may move a booking from `from` to `to`. Unknown statuses never move. */
export function canTransition(from: string, to: string, by: Mover): boolean {
  if (!isBookingStatus(from) || !isBookingStatus(to)) return false;
  return TABLES[by][from].includes(to);
}

/** The statuses `by` may move a booking in `from` to. */
export function transitionsFrom(from: string, by: Mover): readonly BookingStatusValue[] {
  return isBookingStatus(from) ? TABLES[by][from] : [];
}

/** The customer may still move the appointment to another time (cutoffs aside). */
export const CUSTOMER_MOVABLE: readonly BookingStatusValue[] = ["PENDING", "CONFIRMED"];

export function isLive(status: string): boolean {
  return (LIVE_STATUSES as readonly string[]).includes(status);
}

export function isTerminal(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/**
 * A move that gives the booking's time back because the appointment is
 * not going to happen: a cancellation, or a hold whose deposit never
 * arrived. COMPLETED and NO_SHOW also stop holding the time, but the
 * appointment took place (or the customer failed to come); nothing
 * about its payment page, discount or money is undone by them.
 */
export function releasesTime(from: string, to: string): boolean {
  return isLive(from) && (to === "CANCELLED" || to === "FAILED_PAYMENT");
}
