import { describe, expect, it } from "vitest";
import { isLinkPreviewBot, offlineCopyUntil } from "./offline-copy";

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

  it("link previews are recognised; browsers and the app are not", () => {
    expect(isLinkPreviewBot("WhatsApp/2.23.20.0 A")).toBe(true);
    expect(isLinkPreviewBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(true);
    expect(isLinkPreviewBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isLinkPreviewBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isLinkPreviewBot("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36")).toBe(false);
    expect(isLinkPreviewBot(null)).toBe(false);
  });

  it("never past the window: a closed window keeps nothing", () => {
    expect(offlineCopyUntil(booking, access("ready"), new Date("2026-11-03T09:31:00Z"))).toBeNull();
  });
});
