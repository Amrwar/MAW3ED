import { describe, expect, it } from "vitest";

import { businessRecipient, customerRecipient } from "./recipients";
import type { BookingSubject, BusinessSubject } from "./recipients";

const business: BusinessSubject = {
  id: "biz_1",
  slug: "salon",
  nameAr: "صالون",
  phone: "0220000000",
  whatsapp: "201000000001",
  notificationEmail: null,
  notificationPhone: null,
  ownerId: "user_owner",
  ownerEmail: "owner@example.com",
  notifyByEmail: true,
  notifyByWhatsApp: true,
  notifyNewBooking: true,
  notifyCancellation: true,
  notifyPayment: true,
  whatsappAllowed: true,
};

const booking: BookingSubject = {
  id: "bk_1",
  accessToken: "tok",
  customerPhone: "01099999999",
  customerPhoneE164: "201099999999",
  customerEmail: "customer@example.com",
  customerUserId: "user_customer",
  business,
};

describe("who gets what", () => {
  it("never puts the customer's details in the business's notification", () => {
    const r = businessRecipient(business, "booking.created");
    // The whole privacy rule in one assertion: nothing the customer
    // owns may appear in the address the business is reached on.
    expect(r.phone).not.toBe(booking.customerPhone);
    expect(r.phone).not.toBe(booking.customerPhoneE164);
    expect(r.email).not.toBe(booking.customerEmail);
    expect(r.userId).toBe("user_owner");
  });

  it("never puts the business's details in the customer's notification", () => {
    const r = customerRecipient(booking, null);
    expect(r.phone).not.toBe(business.whatsapp);
    expect(r.phone).not.toBe(business.phone);
    expect(r.email).not.toBe(business.ownerEmail);
    expect(r.userId).toBe("user_customer");
  });

  it("reaches the customer on the number they booked under", () => {
    expect(customerRecipient(booking, null).phone).toBe("01099999999");
    expect(customerRecipient(booking, null).email).toBe("customer@example.com");
  });

  it("prefers a business's explicit notification address when it has one", () => {
    const configured = {
      ...business,
      notificationEmail: "bookings@salon.example",
      notificationPhone: "201000000009",
    };
    const r = businessRecipient(configured, "booking.created");
    expect(r.email).toBe("bookings@salon.example");
    expect(r.phone).toBe("201000000009");
  });

  it("falls back from notification phone to WhatsApp to landline", () => {
    expect(businessRecipient(business, "booking.created").phone).toBe("201000000001");
    expect(
      businessRecipient({ ...business, whatsapp: null }, "booking.created").phone,
    ).toBe("0220000000");
    expect(
      businessRecipient({ ...business, whatsapp: null, phone: null }, "booking.created").phone,
    ).toBeNull();
  });
});

describe("preferences", () => {
  it("honours a customer who switched a channel off", () => {
    const r = customerRecipient(booking, {
      notifyByEmail: false,
      notifyByWhatsApp: true,
      notifyBySms: false,
    });
    expect(r.allow.email).toBe(false);
    expect(r.allow.whatsapp).toBe(true);
    expect(r.allow.sms).toBe(false);
  });

  it("still reaches a customer who has no account to hold preferences", () => {
    // Somebody who booked as a guest was never offered a choice, so
    // they have not opted out of their own confirmation.
    const guest = customerRecipient({ ...booking, customerUserId: null }, null);
    expect(guest.allow.whatsapp).toBe(true);
    expect(guest.allow.email).toBe(true);
    // But there is no account to file an in-app notification in.
    expect(guest.allow.inApp).toBe(false);
  });

  it("lets a business mute new bookings without muting cancellations", () => {
    const quiet = { ...business, notifyNewBooking: false };
    expect(businessRecipient(quiet, "booking.created").allow.whatsapp).toBe(false);
    expect(businessRecipient(quiet, "booking.cancelled").allow.whatsapp).toBe(true);
  });

  it("does not let a per-event switch override the channel being off", () => {
    const silent = { ...business, notifyByWhatsApp: false };
    expect(businessRecipient(silent, "booking.created").allow.whatsapp).toBe(false);
    expect(businessRecipient(silent, "booking.created").allow.email).toBe(true);
  });

  it("does not send WhatsApp for a plan that does not include it", () => {
    // WhatsApp is a paid feature. Centralising the sends must not hand
    // it to every free plan on the platform.
    const free = { ...business, whatsappAllowed: false };
    expect(businessRecipient(free, "booking.created").allow.whatsapp).toBe(false);
    expect(businessRecipient(free, "booking.created").allow.email).toBe(true);

    const guest = customerRecipient({ ...booking, business: free }, null);
    expect(guest.allow.whatsapp).toBe(false);
  });

  it("always tells a business its subscription is lapsing", () => {
    // Not an opt-out: their page comes down if they miss it.
    const quiet = { ...business, notifyNewBooking: false, notifyPayment: false };
    expect(businessRecipient(quiet, "subscription.expired").allow.email).toBe(true);
  });
});
