import { describe, expect, it } from "vitest";

import { cairoDateString, cairoDayEnd, cairoDayStart } from "./instants";

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
