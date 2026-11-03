import { describe, expect, it } from "vitest";
import { offlineCopyUntil } from "./offline-copy";

// A 10:00–11:00 booking on 3 Nov 2026 (Cairo, UTC+2 in November), in the
// bookings' wall-clock frame: Cairo time written as UTC.
const booking = {
  status: "CONFIRMED",
  date: new Date("2026-11-03T00:00:00Z"),
  startTime: "10:00",
  endTime: "11:00",
  startsAt: new Date("2026-11-03T10:00:00Z"),
  endsAt: new Date("2026-11-03T11:00:00Z"),
};
const access = (display: string, pass: unknown = null) => ({
  checkIn: { display },
  visitorAccess: { holder: pass ? { pass } : null, guests: [] },
});
// 08:00 Cairo is 06:00 UTC.
const morning = new Date("2026-11-03T06:00:00Z");

describe("how long a phone may keep the booking page offline", () => {
  it("until the check-in window closes (end + 30 min), as a real instant", () => {
    // 11:30 Cairo = 09:30 UTC.
    expect(offlineCopyUntil(booking, access("ready"), morning)?.toISOString()).toBe("2026-11-03T09:30:00.000Z");
    expect(offlineCopyUntil(booking, access("not-yet"), morning)?.toISOString()).toBe("2026-11-03T09:30:00.000Z");
  });

  it("a visitor pass alone is reason enough to keep it", () => {
    expect(offlineCopyUntil(booking, access("checked-in", { token: "x" }), morning)).not.toBeNull();
  });

  it("nothing to show, nothing kept: checked in, unavailable, no payload", () => {
    expect(offlineCopyUntil(booking, access("checked-in"), morning)).toBeNull();
    expect(offlineCopyUntil(booking, access("unavailable"), morning)).toBeNull();
    expect(offlineCopyUntil(booking, null, morning)).toBeNull();
  });

  it("never past the window: a closed window keeps nothing", () => {
    expect(offlineCopyUntil(booking, access("ready"), new Date("2026-11-03T09:31:00Z"))).toBeNull();
  });
});
