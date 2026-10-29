import { describe, expect, it } from "vitest";

import { cairoDateString, cairoDayEnd, cairoDayStart, cairoWallClock, cairoWallDay } from "./instants";

describe("cairoDayStart", () => {
  /** The Cairo wall clock at an instant, for asserting it really is midnight. */
  const clock = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Cairo",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);

  it("lands exactly on midnight under summer time", () => {
    // Egypt is UTC+3 in early October. Assuming +2 gives 01:00, which
    // silently drops everything booked in the first hour of the day.
    const start = cairoDayStart(new Date("2026-10-06T04:58:00Z"));
    expect(clock(start)).toBe("00:00");
    expect(start.toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });

  it("lands exactly on midnight in winter", () => {
    const start = cairoDayStart(new Date("2026-12-01T10:00:00Z"));
    expect(clock(start)).toBe("00:00");
    expect(start.toISOString()).toBe("2026-11-30T22:00:00.000Z");
  });

  it("is the first instant of the day, not merely one during it", () => {
    const now = new Date("2026-10-06T04:58:00Z");
    const start = cairoDayStart(now);
    expect(cairoDateString(start)).toBe(cairoDateString(now));
    // One millisecond earlier belongs to yesterday.
    expect(cairoDateString(new Date(start.getTime() - 1))).not.toBe(cairoDateString(now));
  });

  it("includes an appointment at 00:30 Cairo in its own day", () => {
    // The case the bug lost: 00:30 is after midnight and before 01:00.
    const now = new Date("2026-10-06T04:58:00Z");
    const start = cairoDayStart(now);
    const halfPastMidnight = new Date("2026-10-05T21:30:00Z");
    expect(clock(halfPastMidnight)).toBe("00:30");
    expect(halfPastMidnight >= start).toBe(true);
  });

  it("gives the same answer from any moment in the day", () => {
    const a = cairoDayStart(new Date("2026-10-06T04:00:00Z"));
    const b = cairoDayStart(new Date("2026-10-06T19:00:00Z"));
    expect(a.toISOString()).toBe(b.toISOString());
  });

  it("covers exactly 24 hours", () => {
    const now = new Date("2026-10-06T04:58:00Z");
    expect(cairoDayEnd(now).getTime() - cairoDayStart(now).getTime()).toBe(86_400_000);
  });
});

describe("cairoWallDay — today, in the frame startsAt is stored in", () => {
  it("holds a 22:30 appointment on a summer evening", () => {
    // 19:30Z is 22:30 in Cairo under summer time. The booking is stored
    // as 22:30 "UTC". The real-instant day (cairoDayStart) ends at
    // 21:00Z and dropped it from the owner's Today list.
    const now = new Date("2026-07-01T19:30:00Z");
    const startsAt = new Date("2026-07-01T22:30:00Z");
    const { start, end } = cairoWallDay(now);
    expect(start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(startsAt >= start && startsAt < end).toBe(true);
    expect(startsAt < cairoDayEnd(now)).toBe(false);
  });

  it("does not hold the previous evening's late appointment", () => {
    // 01:00 Cairo in winter is 23:00Z the day before.
    const now = new Date("2026-12-01T23:00:00Z");
    const yesterdayLate = new Date("2026-12-01T23:30:00Z");
    const { start } = cairoWallDay(now);
    expect(start.toISOString()).toBe("2026-12-02T00:00:00.000Z");
    expect(yesterdayLate >= start).toBe(false);
  });

  it("agrees with cairoWallClock on what 'now' is", () => {
    const now = new Date("2026-07-01T14:30:00Z"); // 17:30 Cairo
    expect(cairoWallClock(now).toISOString()).toBe("2026-07-01T17:30:00.000Z");
    // A 20:00 appointment is two and a half hours away, not five and a half.
    const startsAt = new Date("2026-07-01T20:00:00Z");
    expect((startsAt.getTime() - cairoWallClock(now).getTime()) / 60_000).toBe(150);
  });
});
