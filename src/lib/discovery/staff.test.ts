import { describe, expect, it } from "vitest";
import { staffWeek } from "./staff";
import type { DayHours } from "./hours";

const open = (d: number, o = "10:00", c = "22:00"): DayHours => ({ dayOfWeek: d, openTime: o, closeTime: c, isClosed: false });
const closed = (d: number): DayHours => ({ dayOfWeek: d, openTime: "10:00", closeTime: "22:00", isClosed: true });

describe("staffWeek", () => {
  it("follows the business when the member has no hours or days of their own", () => {
    expect(staffWeek([open(0), closed(5)], [], [])).toEqual([open(0), closed(5)]);
  });

  it("closes weekdays the member does not work", () => {
    const week = staffWeek([open(0), open(1)], [1], []);
    expect(week[0].isClosed).toBe(true);
    expect(week[1]).toEqual(open(1));
  });

  it("narrows to the overlap of the member's hours and the business's", () => {
    const [day] = staffWeek([open(2, "10:00", "22:00")], [], [
      { dayOfWeek: 2, startTime: "08:00", endTime: "16:00", isOff: false },
    ]);
    expect(day).toEqual(open(2, "10:00", "16:00"));
  });

  it("treats a day off, or hours outside opening, as closed", () => {
    const week = staffWeek([open(3), open(4, "10:00", "14:00")], [], [
      { dayOfWeek: 3, startTime: "10:00", endTime: "18:00", isOff: true },
      { dayOfWeek: 4, startTime: "15:00", endTime: "20:00", isOff: false },
    ]);
    expect(week.map((d) => d.isClosed)).toEqual([true, true]);
  });

  it("never opens a day the business itself is closed", () => {
    const [day] = staffWeek([closed(5)], [5], [{ dayOfWeek: 5, startTime: "10:00", endTime: "18:00", isOff: false }]);
    expect(day.isClosed).toBe(true);
  });

  it("keeps a business open past midnight bookable until the end of the day", () => {
    const [day] = staffWeek([open(6, "18:00", "02:00")], [], [
      { dayOfWeek: 6, startTime: "20:00", endTime: "23:30", isOff: false },
    ]);
    expect(day).toEqual(open(6, "20:00", "23:30"));
  });
});
