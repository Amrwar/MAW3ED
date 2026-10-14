import { describe, it, expect } from "vitest";
import { arabicForm, count } from "./plural";

describe("count", () => {
  it("takes the four Arabic shapes", () => {
    expect(count(1, "place", "ar")).toBe("مكان واحد");
    expect(count(2, "place", "ar")).toBe("مكانين");
    expect(count(3, "place", "ar")).toBe("3 أماكن");
    expect(count(10, "place", "ar")).toBe("10 أماكن");
    expect(count(11, "place", "ar")).toBe("11 مكان");
    expect(count(99, "place", "ar")).toBe("99 مكان");
  });

  it("decides past 100 by the last two digits, and takes the plural at zero", () => {
    expect(arabicForm(100)).toBe("many");
    expect(arabicForm(103)).toBe("few");
    expect(arabicForm(111)).toBe("many");
    expect(arabicForm(0)).toBe("few");
    expect(count(0, "booking", "ar")).toBe("0 حجوزات");
  });

  it("reads units without واحد", () => {
    expect(count(1, "minute", "ar")).toBe("دقيقة");
    expect(count(5, "minute", "ar")).toBe("5 دقايق");
    expect(count(12, "hour", "ar")).toBe("12 ساعة");
  });

  it("is singular only at one in English, with grouped digits", () => {
    expect(count(1, "review", "en")).toBe("1 review");
    expect(count(0, "review", "en")).toBe("0 reviews");
    expect(count(2, "person", "en")).toBe("2 people");
    expect(count(1200, "place", "en")).toBe("1,200 places");
  });
});

describe("hoursSpan, unitFor and the formatters that use count", () => {
  it("says whole days as days", async () => {
    const { hoursSpan, unitFor } = await import("./plural");
    const { duration, relativeTime } = await import("./format");
    expect(hoursSpan(48, "ar")).toBe("يومين");
    expect(hoursSpan(48, "en")).toBe("2 days");
    expect(hoursSpan(1, "en")).toBe("1 hour");
    expect(hoursSpan(5, "ar")).toBe("5 ساعات");
    expect(unitFor(2, "booking", "ar")).toBe("حجز");
    expect(unitFor(4, "booking", "ar")).toBe("حجوزات");
    expect(unitFor(1, "booking", "en")).toBe("booking");
    expect(duration(5)).toBe("5 دقايق");
    expect(duration(75)).toBe("ساعة و15 دقيقة");
    expect(duration(720)).toBe("12 ساعة");
    expect(relativeTime(-3 * 24 * 60)).toBe("من 3 أيام");
  });
});
