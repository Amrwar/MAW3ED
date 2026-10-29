import { describe, expect, it } from "vitest";
import { computeAvailability, dayWindow, spanMinutes, type AvailabilityInput } from "./availability";
import { wrapClock } from "./time";

/**
 * A café trading until 02:00 used to lose everything after midnight:
 * the window was clamped to 24:00, so its 01:00 tables were never
 * offered. The grid now runs past 24:00 on the day the business opened,
 * and a 01:00 table is Thursday night's, listed under Thursday.
 */
function input(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: "2026-11-05",
    dayOfWeek: 4,
    today: "2026-11-01",
    nowMinutes: 10 * 60,
    daysFromToday: 4,
    serviceDuration: 60,
    policy: { bufferMinutes: 0, minNoticeMinutes: 0, maxAdvanceDays: 60, sameDayCutoff: null },
    businessHours: [{ dayOfWeek: 4, openTime: "20:00", closeTime: "02:00", isClosed: false }],
    staffMemberId: null,
    staffHours: [],
    staffWorkingDays: [],
    branchId: null,
    blocks: [],
    bookings: [],
    resourceId: null,
    ...over,
  };
}

describe("overnight opening hours", () => {
  it("reads 20:00–02:00 as six hours, not as closing before opening", () => {
    expect(spanMinutes("20:00", "02:00")).toEqual({ start: 20 * 60, end: 26 * 60 });
    expect(spanMinutes("09:00", "17:00")).toEqual({ start: 9 * 60, end: 17 * 60 });
  });

  it("offers the slots after midnight under the evening's date", () => {
    const { slots } = computeAvailability(input());
    expect(slots).toEqual(["20:00", "21:00", "22:00", "23:00", "24:00", "25:00"]);
  });

  it("shows those slots as a clock reading with a next-day mark", () => {
    expect(wrapClock("25:00")).toEqual({ time: "01:00", nextDay: true });
    expect(wrapClock("24:00")).toEqual({ time: "00:00", nextDay: true });
    expect(wrapClock("23:30")).toEqual({ time: "23:30", nextDay: false });
  });

  it("collides a 01:00 table with a booking that runs over midnight", () => {
    const { slots } = computeAvailability(input({ bookings: [{ startMin: 23 * 60 + 30, endMin: 25 * 60, staffMemberId: null, resourceId: null }] }));
    expect(slots).toEqual(["20:00", "21:00", "22:00", "25:00"]);
  });

  it("lets a 24-hour business book the whole clock", () => {
    const { slots } = computeAvailability(input({
      businessHours: [{ dayOfWeek: 4, openTime: "00:00", closeTime: "00:00", isClosed: false }],
    }));
    expect(slots).toHaveLength(24);
    expect(slots[0]).toBe("00:00");
    expect(slots[23]).toBe("23:00");
  });

  it("keeps a night shift inside the business's night", () => {
    const day = dayWindow(
      [{ dayOfWeek: 4, openTime: "20:00", closeTime: "02:00", isClosed: false }],
      4,
      { workingDays: [], hours: [{ dayOfWeek: 4, startTime: "22:00", endTime: "04:00", isOff: false }] },
    );
    expect(day).toEqual({ window: { start: 22 * 60, end: 26 * 60 } });
  });

  it("cuts a break that crosses midnight out of the night", () => {
    const { slots } = computeAvailability(input({
      blocks: [{ kind: "BREAK", staffMemberId: null, branchId: null, dayOfWeek: 4, startsOn: null, endsOn: null, startTime: "23:30", endTime: "00:30" }],
    }));
    // The grid restarts after a break, as it always has: 00:30, not 01:00.
    expect(slots).toEqual(["20:00", "21:00", "22:00", "24:30"]);
  });

  it("still offers the rest of last night's tables after midnight", () => {
    // It is 00:20 on Friday; Thursday's night runs until 02:00.
    const { slots, reason } = computeAvailability(input({ today: "2026-11-06", daysFromToday: -1, nowMinutes: 20 }));
    expect(reason).toBeNull();
    expect(slots).toEqual(["25:00"]);
    // With half an hour's notice, 01:00 is too soon.
    expect(computeAvailability(input({ today: "2026-11-06", daysFromToday: -1, nowMinutes: 20, policy: { bufferMinutes: 0, minNoticeMinutes: 45, maxAdvanceDays: 60, sameDayCutoff: null } })).slots).toEqual([]);
    // Once the night is over, yesterday is past.
    expect(computeAvailability(input({ today: "2026-11-06", daysFromToday: -1, nowMinutes: 3 * 60 })).reason).toBe("past");
    // A business that closes before midnight has no such grace.
    expect(computeAvailability(input({ today: "2026-11-06", daysFromToday: -1, nowMinutes: 20, businessHours: [{ dayOfWeek: 4, openTime: "09:00", closeTime: "17:00", isClosed: false }] })).reason).toBe("past");
  });

  it("closes the whole night for an all-day holiday", () => {
    const { slots, reason } = computeAvailability(input({
      blocks: [{ kind: "HOLIDAY", staffMemberId: null, branchId: null, dayOfWeek: null, startsOn: "2026-11-05", endsOn: "2026-11-05", startTime: null, endTime: null }],
    }));
    expect(slots).toEqual([]);
    expect(reason).toBe("holiday");
  });
});
