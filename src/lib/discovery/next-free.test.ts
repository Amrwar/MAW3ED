import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { firstFree, shortest, type Schedule } from "./next-free";

// 2026-10-13 is a Tuesday (2).
const base = (over: Partial<Schedule> = {}): Schedule => ({
  today: "2026-10-13",
  nowMinutes: 8 * 60,
  policy: { bufferMinutes: 0, minNoticeMinutes: 0, maxAdvanceDays: 60, sameDayCutoff: null },
  hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "18:00", isClosed: false })),
  blocks: [],
  bookings: new Map(),
  ...over,
});

describe("firstFree — as the booking engine offers it", () => {
  it("is the opening time today when nothing stands in the way", () => {
    expect(firstFree(base(), 30)).toEqual({ dayOffset: 0, time: "10:00" });
  });

  it("is nothing without a bookable service", () => {
    expect(firstFree(base(), null)).toBeNull();
    expect(firstFree(base(), 0)).toBeNull();
  });

  it("respects minimum notice, the same-day cutoff and the advance window", () => {
    const late = base({ nowMinutes: 15 * 60, policy: { bufferMinutes: 0, minNoticeMinutes: 120, maxAdvanceDays: 60, sameDayCutoff: null } });
    expect(firstFree(late, 30)).toEqual({ dayOffset: 0, time: "17:00" });
    const cut = base({ nowMinutes: 12 * 60, policy: { bufferMinutes: 0, minNoticeMinutes: 0, maxAdvanceDays: 60, sameDayCutoff: "11:00" } });
    expect(firstFree(cut, 30)).toEqual({ dayOffset: 1, time: "10:00" });
    const closedToday = base({ hours: [{ dayOfWeek: 6, openTime: "10:00", closeTime: "18:00", isClosed: false }], policy: { bufferMinutes: 0, minNoticeMinutes: 0, maxAdvanceDays: 2, sameDayCutoff: null } });
    // Saturday is four days out, past a two-day window.
    expect(firstFree(closedToday, 30)).toBeNull();
  });

  it("skips a person's vacation, but not the business's other people", () => {
    const s = base({
      blocks: [
        { kind: "VACATION", staffMemberId: "m1", branchId: null, dayOfWeek: null, startsOn: "2026-10-13", endsOn: "2026-10-14", startTime: null, endTime: null },
      ],
    });
    expect(firstFree(s, 30, { id: "m1", workingDays: [], hours: [] })).toEqual({ dayOffset: 2, time: "10:00" });
    expect(firstFree(s, 30, { id: "m2", workingDays: [], hours: [] })).toEqual({ dayOffset: 0, time: "10:00" });
  });

  it("counts a person's own bookings against them", () => {
    const s = base({ bookings: new Map([["2026-10-13", [{ startMin: 600, endMin: 630, staffMemberId: "m1", resourceId: null }]]]) });
    expect(firstFree(s, 30, { id: "m1", workingDays: [], hours: [] })?.time).not.toBe("10:00");
    expect(firstFree(s, 30, { id: "m2", workingDays: [], hours: [] })?.time).toBe("10:00");
  });

  it("follows a person's working days", () => {
    // Works Thursdays only (4): two days from Tuesday.
    expect(firstFree(base(), 30, { id: "m1", workingDays: [4], hours: [] })).toEqual({ dayOffset: 2, time: "10:00" });
  });
});

describe("shortest", () => {
  it("ignores zero and negative durations", () => {
    expect(shortest([0, 45, 30, -5])).toBe(30);
    expect(shortest([])).toBeNull();
  });
});
