import type { NotificationKind } from "@prisma/client";

/**
 * Everything Maw3ed tells somebody about.
 *
 * An event names what happened, not who to tell or how — the dispatcher
 * works that out. A caller passes an id and the dispatcher loads the
 * rest itself, which is deliberate: it is the reason a call site cannot
 * accidentally hand the business the customer's phone number.
 */

export type BookingEventType =
  | "booking.created"
  | "booking.confirmed"
  | "booking.rejected"
  | "booking.cancelled"
  | "booking.rescheduled"
  | "booking.reminder"
  | "booking.startingSoon"
  | "booking.completed"
  | "review.requested"
  | "payment.received"
  | "payment.failed";

export type SubscriptionEventType =
  | "subscription.renewalDue"
  | "subscription.expired"
  | "subscription.renewed";

export type EventType = BookingEventType | SubscriptionEventType;

/** Who an event concerns. */
export type Audience = "customer" | "business";

export type NotificationEvent =
  /** `by: "business"` when the owner keyed it in — they need no push about their own action. */
  | { type: "booking.created"; bookingId: string; by?: Audience }
  | { type: "booking.confirmed"; bookingId: string }
  | { type: "booking.rejected"; bookingId: string }
  | { type: "booking.cancelled"; bookingId: string; by: Audience }
  | {
      type: "booking.rescheduled";
      bookingId: string;
      /** Included in the key so a second move sends a second message. */
      movedTo: string;
      /** `"business"` when the business moved it (absent: the customer did). */
      by?: Audience;
    }
  | { type: "booking.reminder"; bookingId: string }
  | { type: "booking.startingSoon"; bookingId: string }
  | { type: "booking.completed"; bookingId: string }
  | { type: "review.requested"; bookingId: string }
  | {
      type: "payment.received";
      bookingId: string;
      amount: number;
      /** The provider's transaction id, so a retried webhook is one event. */
      transactionId?: string | null;
    }
  | { type: "payment.failed"; bookingId: string; reason?: string | null }
  | { type: "subscription.renewalDue"; businessId: string; daysLeft: number }
  | { type: "subscription.expired"; businessId: string }
  | { type: "subscription.renewed"; businessId: string; until: Date };

/** The enum stored on an in-app notification, per event. */
export const EVENT_KIND: Record<EventType, NotificationKind> = {
  "booking.created": "BOOKING_CREATED",
  "booking.confirmed": "BOOKING_CONFIRMED",
  "booking.rejected": "BOOKING_REJECTED",
  "booking.cancelled": "BOOKING_CANCELLED",
  "booking.rescheduled": "BOOKING_RESCHEDULED",
  "booking.reminder": "BOOKING_REMINDER",
  "booking.startingSoon": "BOOKING_STARTING_SOON",
  "booking.completed": "BOOKING_COMPLETED",
  "review.requested": "REVIEW_REQUEST",
  "payment.received": "PAYMENT_RECEIVED",
  "payment.failed": "PAYMENT_FAILED",
  "subscription.renewalDue": "SUBSCRIPTION_RENEWAL_DUE",
  "subscription.expired": "SUBSCRIPTION_EXPIRED",
  "subscription.renewed": "SUBSCRIPTION_RENEWED",
};

/**
 * Who hears about each event.
 *
 * A confirmation goes to the customer only — the business is the one
 * who confirmed it and does not need telling. A new booking goes to
 * both: the customer wants a receipt, the business wants to know
 * somebody is coming.
 */
export const EVENT_AUDIENCE: Record<EventType, readonly Audience[]> = {
  "booking.created": ["customer", "business"],
  "booking.confirmed": ["customer"],
  "booking.rejected": ["customer"],
  "booking.cancelled": ["customer", "business"],
  "booking.rescheduled": ["customer", "business"],
  "booking.reminder": ["customer"],
  "booking.startingSoon": ["customer"],
  "booking.completed": ["customer"],
  "review.requested": ["customer"],
  "payment.received": ["customer", "business"],
  "payment.failed": ["customer", "business"],
  "subscription.renewalDue": ["business"],
  "subscription.expired": ["business"],
  "subscription.renewed": ["business"],
};

export function isSubscriptionEvent(
  e: NotificationEvent,
): e is Extract<NotificationEvent, { businessId: string }> {
  return e.type.startsWith("subscription.");
}

/**
 * The idempotency key.
 *
 * It names the event, its subject, who is being told and over which
 * channel. The sender claims the key before sending, so a cron that
 * runs twice, a webhook the payment provider retries, or a
 * double-tapped button all compute the same key and the second one
 * finds it taken.
 *
 * Events that can legitimately happen more than once to the same
 * booking add a discriminator — a reschedule to a new time is a new
 * thing to say, a reminder is not.
 */
export function dedupeKey(
  event: NotificationEvent,
  audience: Audience,
  channel: string,
): string {
  const subject = isSubscriptionEvent(event) ? event.businessId : event.bookingId;

  let extra = "";
  if (event.type === "booking.rescheduled") extra = `:${event.movedTo}`;
  else if (event.type === "payment.received") extra = `:${event.transactionId ?? "na"}`;
  else if (event.type === "booking.cancelled") extra = `:${event.by}`;
  else if (event.type === "subscription.renewalDue") extra = `:${event.daysLeft}`;
  else if (event.type === "subscription.renewed") {
    extra = `:${event.until.toISOString().slice(0, 10)}`;
  }

  return `${event.type}:${subject}${extra}:${audience}:${channel}`;
}
