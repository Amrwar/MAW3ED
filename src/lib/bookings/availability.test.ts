import { describe, expect, it } from "vitest";

import {
  computeAvailability,
  subtractIntervals,
  type AvailabilityInput,
  type BlockRule,
} from "./availability";

/** A weekday nine-to-five business, open every day, nothing booked. */
function base(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: "2026-03-10", // a Tuesday
    dayOfWeek: 2,
    today: "2026-03-10",
    nowMinutes: 8 * 60, // 08:00, before opening
    daysFromToday: 0,
    serviceDuration: 60,
    policy: {
      bufferMinutes: 0,
      minNoticeMinutes: 0,
      maxAdvanceDays: 60,
      sameDayCutoff: null,
    },
    businessHours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      openTime: "09:00",
      closeTime: "17:00",
      isClosed: false,
    })),
    staffMemberId: null,
    staffHours: [],
    staffWorkingDays: [],
    branchId: null,
    blocks: [],
    bookings: [],
    tableId: null,
    ...over,
  };
}

const block = (over: Partial<BlockRule> = {}): BlockRule => ({
  kind: "BREAK",
  staffMemberId: null,
  branchId: null,
  dayOfWeek: null,
  startsOn: null,
  endsOn: null,
  startTime: null,
  endTime: null,
  ...over,
});

describe("subtractIntervals", () => {
  it("returns the whole range when nothing is cut", () => {
    expect(subtractIntervals({ start: 0, end: 100 }, [])).toEqual([{ start: 0, end: 100 }]);
  });

  it("splits a range around a cut in the middle", () => {
    expect(subtractIntervals({ start: 0, end: 100 }, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it("trims from either end", () => {
    expect(subtractIntervals({ start: 0, end: 100 }, [{ start: 0, end: 30 }])).toEqual([
      { start: 30, end: 100 },
    ]);
    expect(subtractIntervals({ start: 0, end: 100 }, [{ start: 70, end: 100 }])).toEqual([
      { start: 0, end: 70 },
    ]);
  });

  it("returns nothing when the cut swallows the range", () => {
    expect(subtractIntervals({ start: 10, end: 20 }, [{ start: 0, end: 100 }])).toEqual([]);
  });

  it("handles several overlapping cuts", () => {
    expect(
      subtractIntervals({ start: 0, end: 100 }, [
        { start: 10, end: 30 },
        { start: 20, end: 40 },
        { start: 80, end: 90 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 40, end: 80 },
      { start: 90, end: 100 },
    ]);
  });
});

describe("business hours", () => {
  it("lays slots from opening to closing", () => {
    expect(computeAvailability(base()).slots).toEqual([
      "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00",
    ]);
  });

  it("never offers a slot that would run past closing", () => {
    const r = computeAvailability(base({ serviceDuration: 90 }));
    // 09:00 through 15:00 fit; 16:00 would end at 17:30.
    expect(r.slots).toEqual(["09:00", "10:30", "12:00", "13:30", "15:00"]);
  });

  it("is empty on a day the business is shut", () => {
    const hours = base().businessHours.map((h) =>
      h.dayOfWeek === 2 ? { ...h, isClosed: true } : h,
    );
    const r = computeAvailability(base({ businessHours: hours }));
    expect(r.slots).toEqual([]);
    expect(r.reason).toBe("business-closed");
  });
});

describe("service duration and buffer", () => {
  it("leaves the buffer free after an existing booking", () => {
    const r = computeAvailability(
      base({
        policy: { ...base().policy, bufferMinutes: 15 },
        bookings: [{ startMin: 600, endMin: 660, staffMemberId: null, tableId: null }], // 10:00–11:00
      }),
    );
    // 11:00 would start inside the 15-minute gap the 10:00 booking holds.
    expect(r.slots).not.toContain("11:00");
    expect(r.slots).toContain("12:00");
  });

  it("keeps the buffer after the new appointment too", () => {
    const r = computeAvailability(
      base({
        policy: { ...base().policy, bufferMinutes: 30 },
        bookings: [{ startMin: 720, endMin: 780, staffMemberId: null, tableId: null }], // 12:00–13:00
      }),
    );
    // An 11:00–12:00 appointment plus 30 minutes would run into 12:00.
    expect(r.slots).not.toContain("11:00");
    expect(r.slots).toContain("10:00");
  });

  it("offers nothing for a service with no duration", () => {
    const r = computeAvailability(base({ serviceDuration: 0 }));
    expect(r.reason).toBe("no-service-duration");
  });
});

describe("existing bookings", () => {
  it("removes a taken slot", () => {
    const r = computeAvailability(
      base({ bookings: [{ startMin: 600, endMin: 660, staffMemberId: null, tableId: null }] }),
    );
    expect(r.slots).not.toContain("10:00");
    expect(r.slots).toContain("09:00");
  });

  it("scopes collision to the staff member asked for", () => {
    const booked = [{ startMin: 600, endMin: 660, staffMemberId: "sara", tableId: null }];
    // Omar is free at 10:00 even though Sara is not.
    expect(
      computeAvailability(base({ staffMemberId: "omar", bookings: booked })).slots,
    ).toContain("10:00");
    expect(
      computeAvailability(base({ staffMemberId: "sara", bookings: booked })).slots,
    ).not.toContain("10:00");
  });

  it("treats an unscoped business as a single resource, as it always has", () => {
    const r = computeAvailability(
      base({ bookings: [{ startMin: 600, endMin: 660, staffMemberId: null, tableId: null }] }),
    );
    expect(r.slots).not.toContain("10:00");
  });
});

describe("staff hours and days", () => {
  it("narrows the window to the member's own hours", () => {
    const r = computeAvailability(
      base({
        staffMemberId: "sara",
        staffHours: [{ dayOfWeek: 2, startTime: "12:00", endTime: "15:00", isOff: false }],
      }),
    );
    expect(r.slots).toEqual(["12:00", "13:00", "14:00"]);
  });

  it("never lets staff hours open the shop early", () => {
    const r = computeAvailability(
      base({
        staffMemberId: "sara",
        staffHours: [{ dayOfWeek: 2, startTime: "06:00", endTime: "23:00", isOff: false }],
      }),
    );
    expect(r.slots[0]).toBe("09:00");
    expect(r.slots.at(-1)).toBe("16:00");
  });

  it("is empty when the member is off that day", () => {
    const r = computeAvailability(
      base({
        staffMemberId: "sara",
        staffHours: [{ dayOfWeek: 2, startTime: "09:00", endTime: "17:00", isOff: true }],
      }),
    );
    expect(r.reason).toBe("staff-off");
  });

  it("is empty when the day is not one they work", () => {
    const r = computeAvailability(base({ staffMemberId: "sara", staffWorkingDays: [0, 1] }));
    expect(r.reason).toBe("staff-off");
  });

  it("falls back to business hours when the member has none set", () => {
    const r = computeAvailability(base({ staffMemberId: "sara" }));
    expect(r.slots).toHaveLength(8);
  });
});

describe("breaks, holidays, closures and vacation", () => {
  it("cuts a weekly break out of the middle of the day", () => {
    const r = computeAvailability(
      base({
        blocks: [block({ kind: "BREAK", dayOfWeek: 2, startTime: "12:00", endTime: "13:00" })],
      }),
    );
    expect(r.slots).not.toContain("12:00");
    expect(r.slots).toContain("11:00");
    expect(r.slots).toContain("13:00");
  });

  it("closes the day for a dated holiday", () => {
    const r = computeAvailability(
      base({
        blocks: [block({ kind: "HOLIDAY", startsOn: "2026-03-09", endsOn: "2026-03-11" })],
      }),
    );
    expect(r.reason).toBe("holiday");
  });

  it("ignores a holiday that ended yesterday", () => {
    const r = computeAvailability(
      base({
        blocks: [block({ kind: "HOLIDAY", startsOn: "2026-03-01", endsOn: "2026-03-09" })],
      }),
    );
    expect(r.slots).toHaveLength(8);
  });

  it("applies one member's vacation only to them", () => {
    const vac = [block({ kind: "VACATION", staffMemberId: "sara", startsOn: "2026-03-10" })];
    expect(computeAvailability(base({ staffMemberId: "sara", blocks: vac })).reason).toBe(
      "vacation",
    );
    expect(computeAvailability(base({ staffMemberId: "omar", blocks: vac })).slots).toHaveLength(8);
  });

  it("applies a branch block only to that branch", () => {
    const b = [block({ kind: "CLOSURE", branchId: "maadi", startsOn: "2026-03-10" })];
    expect(computeAvailability(base({ branchId: "maadi", blocks: b })).reason).toBe(
      "business-closed",
    );
    expect(computeAvailability(base({ branchId: "zamalek", blocks: b })).slots).toHaveLength(8);
  });

  it("ignores a malformed block rather than closing the day forever", () => {
    const r = computeAvailability(base({ blocks: [block({ kind: "BREAK" })] }));
    // Neither weekly nor dated — it applies to nothing.
    expect(r.slots).toHaveLength(8);
  });
});

describe("notice, advance and cutoff", () => {
  it("drops slots inside the minimum notice", () => {
    const r = computeAvailability(
      base({
        nowMinutes: 10 * 60, // 10:00
        policy: { ...base().policy, minNoticeMinutes: 120 },
      }),
    );
    expect(r.slots).not.toContain("11:00");
    expect(r.slots[0]).toBe("12:00");
  });

  it("applies notice only to today", () => {
    const r = computeAvailability(
      base({
        date: "2026-03-11",
        dayOfWeek: 3,
        daysFromToday: 1,
        nowMinutes: 16 * 60,
        policy: { ...base().policy, minNoticeMinutes: 240 },
      }),
    );
    expect(r.slots[0]).toBe("09:00");
  });

  it("refuses a date beyond the advance window", () => {
    const r = computeAvailability(
      base({ daysFromToday: 61, policy: { ...base().policy, maxAdvanceDays: 60 } }),
    );
    expect(r.reason).toBe("too-far-ahead");
  });

  it("refuses a date in the past", () => {
    expect(computeAvailability(base({ daysFromToday: -1 })).reason).toBe("past");
  });

  it("closes today once the same-day cutoff has passed", () => {
    const r = computeAvailability(
      base({ nowMinutes: 15 * 60, policy: { ...base().policy, sameDayCutoff: "14:00" } }),
    );
    expect(r.reason).toBe("same-day-cutoff");
  });

  it("leaves the cutoff alone before it is reached, and on other days", () => {
    expect(
      computeAvailability(
        base({ nowMinutes: 13 * 60, policy: { ...base().policy, sameDayCutoff: "14:00" } }),
      ).slots.length,
    ).toBeGreaterThan(0);

    expect(
      computeAvailability(
        base({
          daysFromToday: 1,
          nowMinutes: 23 * 60,
          policy: { ...base().policy, sameDayCutoff: "14:00" },
        }),
      ).slots,
    ).toHaveLength(8);
  });
});

describe("the rules together", () => {
  it("applies hours, a break, a buffer, a booking and notice at once", () => {
    const r = computeAvailability(
      base({
        nowMinutes: 9 * 60 + 30,
        serviceDuration: 60,
        policy: {
          bufferMinutes: 15,
          minNoticeMinutes: 60,
          maxAdvanceDays: 30,
          sameDayCutoff: "16:00",
        },
        blocks: [block({ kind: "BREAK", dayOfWeek: 2, startTime: "13:00", endTime: "14:00" })],
        bookings: [{ startMin: 660, endMin: 720, staffMemberId: null, tableId: null }], // 11:00–12:00
      }),
    );

    // 09:00 and 10:00 are inside the hour of notice from 09:30.
    expect(r.slots).not.toContain("09:00");
    expect(r.slots).not.toContain("10:00");
    // 11:00 is booked; 12:00 starts inside its 15-minute buffer.
    expect(r.slots).not.toContain("11:00");
    expect(r.slots).not.toContain("12:00");
    // 13:00 is the break.
    expect(r.slots).not.toContain("13:00");
    // 14:00 is clear, and fits before 17:00.
    expect(r.slots).toContain("14:00");
  });
});
