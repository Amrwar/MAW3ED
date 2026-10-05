import { describe, expect, it } from "vitest";

import {
  cairoNow,
  daysUntilOpen,
  isOpenAt,
  isValidTime,
  openState,
  type DayHours,
} from "./hours";

const rule = (dayOfWeek: number, openTime: string, closeTime: string, isClosed = false): DayHours => ({
  dayOfWeek,
  openTime,
  closeTime,
  isClosed,
});

describe("isValidTime", () => {
  it("accepts a zero-padded 24-hour clock", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("09:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });

  it("rejects anything that would break a string comparison", () => {
    expect(isValidTime("9:30")).toBe(false);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("")).toBe(false);
  });
});

describe("isOpenAt", () => {
  const nine2nine = rule(1, "09:00", "21:00");

  it("is open between the hours and closed outside them", () => {
    expect(isOpenAt(nine2nine, "09:00")).toBe(true);
    expect(isOpenAt(nine2nine, "14:30")).toBe(true);
    expect(isOpenAt(nine2nine, "08:59")).toBe(false);
  });

  it("treats closing time as the moment you can no longer be served", () => {
    expect(isOpenAt(nine2nine, "20:59")).toBe(true);
    expect(isOpenAt(nine2nine, "21:00")).toBe(false);
  });

  it("wraps past midnight when closing is before opening", () => {
    const lateNight = rule(5, "18:00", "02:00");
    expect(isOpenAt(lateNight, "23:30")).toBe(true);
    expect(isOpenAt(lateNight, "01:30")).toBe(true);
    expect(isOpenAt(lateNight, "02:00")).toBe(false);
    expect(isOpenAt(lateNight, "12:00")).toBe(false);
  });

  it("is closed on a rest day and when there is no rule at all", () => {
    expect(isOpenAt(rule(5, "09:00", "21:00", true), "12:00")).toBe(false);
    expect(isOpenAt(undefined, "12:00")).toBe(false);
  });

  it("is closed rather than throwing on malformed stored hours", () => {
    expect(isOpenAt(rule(1, "9am", "5pm"), "12:00")).toBe(false);
  });
});

describe("daysUntilOpen", () => {
  const weekdays = [0, 1, 2, 3, 4].map((d) => rule(d, "09:00", "17:00"));

  it("counts today while the doors are still open", () => {
    expect(daysUntilOpen(weekdays, 1, "12:00")).toBe(0);
  });

  it("counts today when it has not opened yet", () => {
    expect(daysUntilOpen(weekdays, 1, "07:00")).toBe(0);
  });

  it("moves to the next day once today has closed", () => {
    expect(daysUntilOpen(weekdays, 1, "19:00")).toBe(1);
  });

  it("skips the days the business is shut", () => {
    // Thursday evening: Friday and Saturday are closed, so Sunday.
    expect(daysUntilOpen(weekdays, 4, "19:00")).toBe(3);
  });

  it("wraps around the end of the week", () => {
    expect(daysUntilOpen([rule(1, "09:00", "17:00")], 2, "10:00")).toBe(6);
  });

  it("returns null when no hours are set at all", () => {
    expect(daysUntilOpen([], 1, "12:00")).toBeNull();
    expect(daysUntilOpen([rule(1, "09:00", "17:00", true)], 1, "12:00")).toBeNull();
  });
});

describe("openState", () => {
  const weekdays = [0, 1, 2, 3, 4].map((d) => rule(d, "09:00", "17:00"));

  it("reports open with the time it closes", () => {
    expect(openState(weekdays, 1, "12:00")).toEqual({ state: "open", closesAt: "17:00" });
  });

  it("reports closed with when it opens next", () => {
    expect(openState(weekdays, 1, "19:00")).toEqual({
      state: "closed",
      opensInDays: 1,
      opensAt: "09:00",
    });
  });

  it("says nothing at all when the owner has set no hours", () => {
    // The card stays silent rather than telling a customer it is shut.
    expect(openState([], 1, "12:00")).toEqual({ state: "unknown" });
  });

  it("is unknown rather than closed when every day is marked shut", () => {
    const allShut = [0, 1, 2, 3, 4, 5, 6].map((d) => rule(d, "09:00", "17:00", true));
    expect(openState(allShut, 1, "12:00")).toEqual({ state: "unknown" });
  });
});

describe("cairoNow", () => {
  it("reads the Cairo wall clock, not the server's", () => {
    // 2026-01-05 is a Monday. 22:00 UTC is already Tuesday in Cairo.
    const { dayOfWeek, time } = cairoNow(new Date("2026-01-05T22:00:00Z"));
    expect(dayOfWeek).toBe(2);
    expect(time).toBe("00:00");
  });

  it("returns a weekday in range and a comparable clock string", () => {
    const { dayOfWeek, time } = cairoNow(new Date("2026-06-15T09:15:00Z"));
    expect(dayOfWeek).toBeGreaterThanOrEqual(0);
    expect(dayOfWeek).toBeLessThanOrEqual(6);
    expect(isValidTime(time)).toBe(true);
  });
});
