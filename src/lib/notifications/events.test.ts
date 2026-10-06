import { describe, expect, it } from "vitest";

import { EVENT_AUDIENCE, EVENT_KIND, dedupeKey } from "./events";
import type { NotificationEvent } from "./events";

describe("the event catalogue", () => {
  it("gives every event a stored kind and an audience", () => {
    for (const type of Object.keys(EVENT_KIND) as (keyof typeof EVENT_KIND)[]) {
      expect(EVENT_KIND[type], type).toBeTruthy();
      expect(EVENT_AUDIENCE[type]?.length, type).toBeGreaterThan(0);
    }
  });

  it("tells the business about a subscription and nobody else", () => {
    expect(EVENT_AUDIENCE["subscription.expired"]).toEqual(["business"]);
    expect(EVENT_AUDIENCE["subscription.renewalDue"]).toEqual(["business"]);
  });

  it("does not tell the business it confirmed its own booking", () => {
    expect(EVENT_AUDIENCE["booking.confirmed"]).toEqual(["customer"]);
  });
});

describe("dedupeKey", () => {
  const reminder: NotificationEvent = { type: "booking.reminder", bookingId: "bk_1" };

  it("is the same for the same event, recipient and channel", () => {
    // The cron running twice must not produce a second reminder.
    expect(dedupeKey(reminder, "customer", "WHATSAPP")).toBe(
      dedupeKey(reminder, "customer", "WHATSAPP"),
    );
  });

  it("separates the channels, so one message does not suppress another", () => {
    expect(dedupeKey(reminder, "customer", "WHATSAPP")).not.toBe(
      dedupeKey(reminder, "customer", "EMAIL"),
    );
  });

  it("separates the audiences", () => {
    const created: NotificationEvent = { type: "booking.created", bookingId: "bk_1" };
    expect(dedupeKey(created, "customer", "EMAIL")).not.toBe(
      dedupeKey(created, "business", "EMAIL"),
    );
  });

  it("separates two bookings", () => {
    expect(dedupeKey(reminder, "customer", "EMAIL")).not.toBe(
      dedupeKey({ type: "booking.reminder", bookingId: "bk_2" }, "customer", "EMAIL"),
    );
  });

  it("lets a second reschedule send a second message", () => {
    // Moving an appointment twice is two things worth saying.
    const first: NotificationEvent = {
      type: "booking.rescheduled",
      bookingId: "bk_1",
      movedTo: "2026-10-07T14:00",
    };
    const second: NotificationEvent = { ...first, movedTo: "2026-10-09T16:00" };
    expect(dedupeKey(first, "customer", "EMAIL")).not.toBe(
      dedupeKey(second, "customer", "EMAIL"),
    );
  });

  it("treats a retried payment webhook as one event", () => {
    // Paymob retries; the same transaction must not thank them twice.
    const a: NotificationEvent = {
      type: "payment.received",
      bookingId: "bk_1",
      amount: 100,
      transactionId: "tx_9",
    };
    expect(dedupeKey(a, "customer", "EMAIL")).toBe(
      dedupeKey({ ...a, amount: 100 }, "customer", "EMAIL"),
    );
    expect(dedupeKey(a, "customer", "EMAIL")).not.toBe(
      dedupeKey({ ...a, transactionId: "tx_10" }, "customer", "EMAIL"),
    );
  });

  it("distinguishes who cancelled", () => {
    const byCustomer: NotificationEvent = {
      type: "booking.cancelled",
      bookingId: "bk_1",
      by: "customer",
    };
    const byBusiness: NotificationEvent = { ...byCustomer, by: "business" };
    expect(dedupeKey(byCustomer, "customer", "EMAIL")).not.toBe(
      dedupeKey(byBusiness, "customer", "EMAIL"),
    );
  });

  it("sends each step of a lapsing subscription once", () => {
    const sevenDays: NotificationEvent = {
      type: "subscription.renewalDue",
      businessId: "biz_1",
      daysLeft: 7,
    };
    const oneDay: NotificationEvent = { ...sevenDays, daysLeft: 1 };
    expect(dedupeKey(sevenDays, "business", "EMAIL")).not.toBe(
      dedupeKey(oneDay, "business", "EMAIL"),
    );
    expect(dedupeKey(sevenDays, "business", "EMAIL")).toBe(
      dedupeKey({ ...sevenDays }, "business", "EMAIL"),
    );
  });
});
