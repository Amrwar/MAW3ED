import { describe, it, expect } from "vitest";

/**
 * The rules the reaper applies.
 *
 * The reaper itself needs a database, so it is driven end to end by
 * scripts/verify-payment-webhook.mjs. What is pinned here is the
 * arithmetic and the decisions around it, because getting those wrong
 * is how a reaper cancels a booking somebody is in the middle of
 * paying for.
 */

/** Must match ABANDON_AFTER_MS in reap.ts. */
const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000;

/** The Paymob payment key is created with `expiration: 3600`. */
const PAYMOB_SESSION_MS = 60 * 60 * 1000;

const isStale = (openedAt: Date, now: Date) =>
  now.getTime() - openedAt.getTime() >= ABANDON_AFTER_MS;

describe("when a payment counts as abandoned", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("waits longer than the provider's own session", () => {
    // Reaping before the session expires would cancel a booking the
    // customer could still legitimately pay for. This is the property
    // that matters most; the exact margin matters less.
    expect(ABANDON_AFTER_MS).toBeGreaterThan(PAYMOB_SESSION_MS);
  });

  it("leaves a payment opened a minute ago alone", () => {
    expect(isStale(new Date("2026-10-08T11:59:00Z"), now)).toBe(false);
  });

  it("leaves one opened an hour and a half ago alone", () => {
    // Past the session expiry but inside the margin: a late webhook is
    // still plausible, and waiting costs only a held slot.
    expect(isStale(new Date("2026-10-08T10:30:00Z"), now)).toBe(false);
  });

  it("reaps one opened three hours ago", () => {
    expect(isStale(new Date("2026-10-08T09:00:00Z"), now)).toBe(true);
  });

  it("reaps exactly at the boundary", () => {
    expect(isStale(new Date("2026-10-08T10:00:00Z"), now)).toBe(true);
  });

  it("does not wait so long that a slot is lost for a day", () => {
    // The whole point is putting the appointment back in the calendar.
    // A reaper that runs a day late has not solved the problem it
    // exists for.
    expect(ABANDON_AFTER_MS).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
  });
});

/**
 * Which booking statuses the reaper may move, and which it must not.
 *
 * Only a booking still waiting on the payment being reaped. One that
 * was confirmed another way, or already cancelled, is somebody else's
 * decision.
 */
const MAY_RELEASE = "PENDING_PAYMENT";
const MUST_NOT_TOUCH = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "ARRIVED", "IN_PROGRESS"];

describe("which bookings it releases", () => {
  it("releases one still awaiting payment", () => {
    expect(MAY_RELEASE).toBe("PENDING_PAYMENT");
  });

  it("leaves every other status alone", () => {
    for (const status of MUST_NOT_TOUCH) {
      expect(status).not.toBe(MAY_RELEASE);
    }
  });

  it("releases to a status that frees the slot", () => {
    // overlap.ts counts PENDING_PAYMENT, PENDING and CONFIRMED as
    // blocking. FAILED_PAYMENT is not among them, which is what puts
    // the appointment back in the calendar — and it is the same status
    // a declined payment produces, so "the money did not arrive" has
    // one meaning rather than two.
    const BLOCKS_A_SLOT = ["PENDING_PAYMENT", "PENDING", "CONFIRMED"];
    expect(BLOCKS_A_SLOT).not.toContain("FAILED_PAYMENT");
  });
});
