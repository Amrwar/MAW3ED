import type { NotificationChannel } from "@prisma/client";
import type { SendOutcome } from "@/lib/services/send-outcome";
import type { BookingEmailData } from "@/lib/services/email";
import type { BookingNotificationData } from "@/lib/services/whatsapp-messages";
import {
  sendBookingConfirmationToCustomer,
  sendBookingReminderToCustomer,
  sendNewBookingAlertToBusiness,
  sendPaymentReceivedToBusiness,
  sendRescheduleAlertToBusiness,
  sendRescheduleConfirmationToCustomer,
  sendSubscriptionExpiredEmail,
  sendSubscriptionRenewalReminder,
} from "@/lib/services/email";
import {
  sendBusinessBookingTemplate,
  sendCustomerConfirmationTemplate,
  sendCustomerReminderTemplate,
} from "@/lib/services/whatsapp";
import type { Audience, EventType, NotificationEvent } from "./events";

/**
 * The messages that were written by hand, kept.
 *
 * A booking confirmation with the full appointment laid out in a table
 * reads better than anything generic, and the WhatsApp templates are
 * approved by Meta and cannot be replaced with freeform text anyway.
 * So the dispatcher does not replace them: for the events that have a
 * bespoke message it sends that one, and only falls back to the
 * general-purpose email for events that never had one.
 *
 * This is the whole of "improve rather than replace" — the senders are
 * untouched, they simply have one caller now instead of six.
 */

export interface BespokeContext {
  email: BookingEmailData | null;
  whatsapp: BookingNotificationData | null;
  subscription: {
    businessName: string;
    planName: string;
    expiryDate: string;
    daysLeft: number;
    renewUrl: string;
  } | null;
}

type Bespoke = (to: string, ctx: BespokeContext) => Promise<SendOutcome> | null;

/**
 * Returns the hand-written sender for this event, or null to use the
 * general-purpose one.
 */
export function bespokeSender(
  event: NotificationEvent,
  audience: Audience,
  channel: NotificationChannel,
): Bespoke | null {
  const key = `${event.type}|${audience}|${channel}` as const;

  switch (key) {
    /* ── A new booking ─────────────────────────────────── */
    case "booking.created|customer|EMAIL":
      return (to, c) => (c.email ? sendBookingConfirmationToCustomer(to, c.email) : null);
    case "booking.created|customer|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendCustomerConfirmationTemplate(to, c.whatsapp) : null);
    case "booking.created|business|EMAIL":
      return (to, c) => (c.email ? sendNewBookingAlertToBusiness(to, c.email) : null);
    case "booking.created|business|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendBusinessBookingTemplate(to, c.whatsapp) : null);

    /* ── Confirmed by the business ─────────────────────── */
    case "booking.confirmed|customer|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendCustomerConfirmationTemplate(to, c.whatsapp) : null);
    case "booking.confirmed|customer|EMAIL":
      return (to, c) => (c.email ? sendBookingConfirmationToCustomer(to, c.email) : null);

    /* ── Reminders ─────────────────────────────────────── */
    case "booking.reminder|customer|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendCustomerReminderTemplate(to, c.whatsapp) : null);
    case "booking.reminder|customer|EMAIL":
      return (to, c) => (c.email ? sendBookingReminderToCustomer(to, c.email) : null);

    /* ── Moved ─────────────────────────────────────────── */
    case "booking.rescheduled|customer|EMAIL":
      return (to, c) => (c.email ? sendRescheduleConfirmationToCustomer(to, c.email) : null);
    case "booking.rescheduled|customer|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendCustomerConfirmationTemplate(to, c.whatsapp) : null);
    case "booking.rescheduled|business|EMAIL":
      return (to, c) => (c.email ? sendRescheduleAlertToBusiness(to, c.email) : null);
    case "booking.rescheduled|business|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendBusinessBookingTemplate(to, c.whatsapp) : null);

    /* ── Paid ──────────────────────────────────────────── */
    case "payment.received|business|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendBusinessBookingTemplate(to, c.whatsapp) : null);
    case "payment.received|business|EMAIL":
      return (to, c) => (c.email ? sendPaymentReceivedToBusiness(to, c.email) : null);
    case "payment.received|customer|WHATSAPP":
      return (to, c) => (c.whatsapp ? sendCustomerConfirmationTemplate(to, c.whatsapp) : null);

    /* ── Subscription ──────────────────────────────────── */
    case "subscription.renewalDue|business|EMAIL":
      return (to, c) =>
        c.subscription ? sendSubscriptionRenewalReminder(to, c.subscription) : null;
    case "subscription.expired|business|EMAIL":
      return (to, c) =>
        c.subscription
          ? sendSubscriptionExpiredEmail(to, {
              businessName: c.subscription.businessName,
              planName: c.subscription.planName,
              renewUrl: c.subscription.renewUrl,
            })
          : null;

    default:
      return null;
  }
}

/** Events that have no hand-written message and use the general one. */
export const GENERIC_ONLY: readonly EventType[] = [
  "booking.rejected",
  "booking.cancelled",
  "booking.startingSoon",
  "booking.completed",
  "review.requested",
  "payment.failed",
  "subscription.renewed",
];
