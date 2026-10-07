import type { Audience, EventType, NotificationEvent } from "./events";

/**
 * Who to tell, and how to reach them.
 *
 * The one rule this file exists to enforce: a recipient's addresses
 * come only from their own side of the booking. The business's alert
 * carries the business's phone and the owner's email; the customer's
 * carries theirs. Nothing here can read across, because the two are
 * built by separate functions from separate fields and a test asserts
 * that neither contains the other's.
 *
 * `userId` is who an in-app notification belongs to. A customer who has
 * never signed in has none — their booking link and their WhatsApp
 * message still work, there is simply no account to file anything in.
 */
export interface Recipient {
  audience: Audience;
  userId: string | null;
  phone: string | null;
  email: string | null;
  /** Where tapping the in-app notification should go. */
  href: string;
  allow: { inApp: boolean; email: boolean; whatsapp: boolean; sms: boolean; push: boolean };
}

/** Exactly the shape the dispatcher loads; kept narrow on purpose. */
export interface BookingSubject {
  id: string;
  accessToken: string | null;
  customerPhone: string;
  customerPhoneE164: string | null;
  customerEmail: string | null;
  customerUserId: string | null;
  business: BusinessSubject;
}

export interface BusinessSubject {
  id: string;
  slug: string;
  nameAr: string;
  phone: string | null;
  whatsapp: string | null;
  notificationEmail: string | null;
  notificationPhone: string | null;
  ownerId: string;
  ownerEmail: string | null;
  notifyByEmail: boolean;
  notifyByWhatsApp: boolean;
  notifyNewBooking: boolean;
  notifyCancellation: boolean;
  notifyPayment: boolean;
  /**
   * Whether this business's plan includes WhatsApp.
   *
   * It is a paid feature and always has been — the booking route gated
   * every WhatsApp send on it. Centralising the sends would have handed
   * it to every free plan on the platform if this did not come with
   * them, so it is part of the recipient, not an afterthought.
   */
  whatsappAllowed: boolean;
}

/** A customer's own channel preferences, when they have an account. */
export interface CustomerPrefs {
  notifyByEmail: boolean;
  notifyByWhatsApp: boolean;
  notifyBySms: boolean;
}

/**
 * A customer without an account has no preferences to read, and the
 * honest default is the behaviour they already get: the confirmation
 * for the booking they just made. Somebody who has never been offered
 * a choice has not opted out of anything.
 */
const GUEST_PREFS: CustomerPrefs = {
  notifyByEmail: true,
  notifyByWhatsApp: true,
  notifyBySms: false,
};

export function customerRecipient(
  subject: BookingSubject,
  prefs: CustomerPrefs | null,
): Recipient {
  const p = prefs ?? GUEST_PREFS;
  return {
    audience: "customer",
    userId: subject.customerUserId,
    // The number they booked under, never the business's.
    phone: subject.customerPhone,
    email: subject.customerEmail,
    href: subject.accessToken ? `/booking/${subject.accessToken}` : "/account",
    allow: {
      // There is nowhere to file an in-app notification without an
      // account, so it is not "denied" — it is not possible.
      inApp: subject.customerUserId !== null,
      email: p.notifyByEmail,
      // Both sides of a booking's WhatsApp ride on the business's plan.
      whatsapp: p.notifyByWhatsApp && subject.business.whatsappAllowed,
      sms: p.notifyBySms,
      // Only an account can have a device registered against it, so a
      // guest booking is not "denied" push — there is nowhere to send
      // one. Whether a device exists is checked by the sender.
      push: subject.customerUserId !== null,
    },
  };
}

export function businessRecipient(
  business: BusinessSubject,
  event: EventType,
): Recipient {
  return {
    audience: "business",
    userId: business.ownerId,
    // The business's own number: its explicit notification phone, else
    // its WhatsApp, else its landline. Never the customer's.
    phone: business.notificationPhone ?? business.whatsapp ?? business.phone,
    email: business.notificationEmail ?? business.ownerEmail,
    href: "/dashboard/bookings",
    allow: {
      inApp: true,
      email: business.notifyByEmail && wantsEvent(business, event),
      whatsapp:
        business.notifyByWhatsApp && business.whatsappAllowed && wantsEvent(business, event),
      // A business has no SMS number field of its own yet; it would be
      // the notification phone when one is configured.
      sms: false,
      // The owner's own account, if they have the app.
      push: wantsEvent(business, event),
    },
  };
}

/**
 * The per-event switches a business controls. Anything not listed is
 * something they are not offered a choice about — a subscription about
 * to lapse is not optional reading.
 */
function wantsEvent(b: BusinessSubject, event: EventType): boolean {
  switch (event) {
    case "booking.created":
    case "booking.rescheduled":
      return b.notifyNewBooking;
    case "booking.cancelled":
      return b.notifyCancellation;
    case "payment.received":
    case "payment.failed":
      return b.notifyPayment;
    default:
      return true;
  }
}

/** The business's in-app notification should land on the right page. */
export function hrefForBusiness(event: NotificationEvent): string {
  if (event.type.startsWith("subscription.")) return "/dashboard/settings";
  if (event.type.startsWith("payment.")) return "/dashboard/bookings";
  return "/dashboard/bookings";
}
