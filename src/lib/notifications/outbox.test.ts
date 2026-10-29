import { describe, expect, it } from "vitest";
import { MAX_ATTEMPTS, isPermanentFailure, isStaleEvent, nextAttemptAt, reviveEvent, serializeEvent } from "./outbox";

describe("retry policy", () => {
  const now = new Date("2026-11-01T10:00:00Z");

  it("backs off, then gives up", () => {
    expect(nextAttemptAt(1, now)?.toISOString()).toBe("2026-11-01T10:02:00.000Z");
    expect(nextAttemptAt(2, now)?.toISOString()).toBe("2026-11-01T10:10:00.000Z");
    expect(nextAttemptAt(3, now)?.toISOString()).toBe("2026-11-01T10:30:00.000Z");
    expect(nextAttemptAt(4, now)?.toISOString()).toBe("2026-11-01T12:00:00.000Z");
    expect(nextAttemptAt(MAX_ATTEMPTS, now)).toBeNull();
  });

  it("does not retry what cannot improve", () => {
    expect(isPermanentFailure("invalid-phone")).toBe(true);
    expect(isPermanentFailure("device-not-registered")).toBe(true);
    expect(isPermanentFailure("http-400")).toBe(true);
    expect(isPermanentFailure("http-404")).toBe(true);
  });

  it("retries the provider's own problems and the unknown", () => {
    expect(isPermanentFailure("http-429")).toBe(false);
    expect(isPermanentFailure("http-500")).toBe(false);
    expect(isPermanentFailure("http-503")).toBe(false);
    expect(isPermanentFailure("network-error")).toBe(false);
    expect(isPermanentFailure("expo-unreachable")).toBe(false);
    expect(isPermanentFailure(undefined)).toBe(false);
  });
});

describe("staleness", () => {
  const wallNow = new Date("2026-11-01T12:00:00Z");

  it("drops a reminder for an appointment that started over an hour ago", () => {
    expect(isStaleEvent({ type: "booking.reminder", bookingId: "b", startsAt: "2026-11-01T10:30:00.000Z" }, wallNow)).toBe(true);
    expect(isStaleEvent({ type: "booking.startingSoon", bookingId: "b", startsAt: "2026-11-01T10:30:00.000Z" }, wallNow)).toBe(true);
  });

  it("keeps a reminder that is merely late", () => {
    expect(isStaleEvent({ type: "booking.reminder", bookingId: "b", startsAt: "2026-11-01T12:30:00.000Z" }, wallNow)).toBe(false);
    expect(isStaleEvent({ type: "booking.reminder", bookingId: "b", startsAt: "2026-11-01T11:30:00.000Z" }, wallNow)).toBe(false);
  });

  it("never drops a confirmation, cancellation or receipt", () => {
    expect(isStaleEvent({ type: "booking.confirmed", bookingId: "b" }, wallNow)).toBe(false);
    expect(isStaleEvent({ type: "booking.cancelled", bookingId: "b", by: "customer" }, wallNow)).toBe(false);
    expect(isStaleEvent({ type: "payment.received", bookingId: "b", amount: 50 }, wallNow)).toBe(false);
  });
});

describe("the stored event", () => {
  it("round-trips, dates included", () => {
    const until = new Date("2027-01-01T00:00:00Z");
    const stored = serializeEvent({ type: "subscription.renewed", businessId: "biz", until });
    const back = reviveEvent(stored);
    expect(back).toEqual({ type: "subscription.renewed", businessId: "biz", until });
    expect(reviveEvent(serializeEvent({ type: "booking.cancelled", bookingId: "b", by: "business", actorUserId: "u" })))
      .toEqual({ type: "booking.cancelled", bookingId: "b", by: "business", actorUserId: "u" });
  });

  it("refuses anything that is not an event", () => {
    expect(reviveEvent(null)).toBeNull();
    expect(reviveEvent("booking.confirmed")).toBeNull();
    expect(reviveEvent({ bookingId: "b" })).toBeNull();
    expect(reviveEvent([1, 2])).toBeNull();
  });
});
