import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, error: () => undefined, info: () => undefined } }));
vi.mock("@/lib/services/email", () => ({ sendEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/services/whatsapp", () => ({ sendWhatsAppMessage: async () => ({ ok: true }) }));

import { allows, pushData, pushWorthy } from "./channels";
import type { Recipient } from "./recipients";

const recipient = (audience: "customer" | "business", push = true): Recipient => ({
  audience,
  userId: "u",
  phone: null,
  email: null,
  href: "/",
  allow: { inApp: true, email: false, whatsapp: false, sms: false, push },
});

describe("which events push", () => {
  it("does not push a customer about a booking they just made or moved", () => {
    expect(pushWorthy({ type: "booking.created", bookingId: "b" }, "customer")).toBe(false);
    expect(pushWorthy({ type: "booking.rescheduled", bookingId: "b", movedTo: "x" }, "customer")).toBe(false);
  });

  it("pushes what the customer would want to know now", () => {
    for (const type of ["booking.confirmed", "booking.rejected", "booking.reminder", "booking.startingSoon", "review.requested"] as const) {
      expect(pushWorthy({ type, bookingId: "b" }, "customer")).toBe(true);
    }
  });

  it("tells only the side that did not cancel", () => {
    expect(pushWorthy({ type: "booking.cancelled", bookingId: "b", by: "business" }, "customer")).toBe(true);
    expect(pushWorthy({ type: "booking.cancelled", bookingId: "b", by: "business" }, "business")).toBe(false);
    expect(pushWorthy({ type: "booking.cancelled", bookingId: "b", by: "customer" }, "business")).toBe(true);
    expect(pushWorthy({ type: "booking.cancelled", bookingId: "b", by: "customer" }, "customer")).toBe(false);
  });

  it("respects a recipient who has no push allowed (owner switches, guests)", () => {
    const e = { type: "booking.created" as const, bookingId: "b" };
    expect(allows(recipient("business", true), "PUSH", e)).toBe(true);
    expect(allows(recipient("business", false), "PUSH", e)).toBe(false);
  });
});

describe("what a push carries", () => {
  it("routes a customer by booking id and never includes an access token", () => {
    const data = pushData({ type: "booking.confirmed", bookingId: "bk1" }, "customer", "bk1");
    expect(data).toEqual({ kind: "booking.confirmed", path: "/account/upcoming", bookingId: "bk1" });
    expect(JSON.stringify(data)).not.toMatch(/booking\/[a-f0-9]{16,}/);
  });

  it("sends an owner to the dashboard", () => {
    expect(pushData({ type: "booking.created", bookingId: "bk1" }, "business", "bk1")).toEqual({
      kind: "booking.created",
      path: "/dashboard/bookings",
    });
  });
});
