import { describe, expect, it } from "vitest";

import { dayOfWeekFor, parseWhen } from "./search";

/** A Sunday and a Saturday, so the week-wrap is covered both ways. */
const SUNDAY = new Date(2026, 0, 4); // 2026-01-04
const SATURDAY = new Date(2026, 0, 10); // 2026-01-10

describe("parseWhen", () => {
  it("accepts the two values the control can post", () => {
    expect(parseWhen("today")).toBe("today");
    expect(parseWhen("tomorrow")).toBe("tomorrow");
  });

  it("rejects anything else, including a hand-edited URL", () => {
    expect(parseWhen(undefined)).toBe("");
    expect(parseWhen("")).toBe("");
    expect(parseWhen("any")).toBe("");
    expect(parseWhen("TODAY")).toBe("");
    expect(parseWhen("next-week")).toBe("");
  });
});

describe("dayOfWeekFor", () => {
  it("returns null when no day was asked for, so the filter is skipped", () => {
    expect(dayOfWeekFor(undefined, SUNDAY)).toBeNull();
    expect(dayOfWeekFor("any", SUNDAY)).toBeNull();
    expect(dayOfWeekFor("", SUNDAY)).toBeNull();
  });

  it("maps today to the current weekday", () => {
    expect(dayOfWeekFor("today", SUNDAY)).toBe(0);
    expect(dayOfWeekFor("today", SATURDAY)).toBe(6);
  });

  it("maps tomorrow to the next weekday", () => {
    expect(dayOfWeekFor("tomorrow", SUNDAY)).toBe(1);
  });

  it("wraps Saturday round to Sunday rather than returning 7", () => {
    expect(dayOfWeekFor("tomorrow", SATURDAY)).toBe(0);
  });

  it("only ever returns a value Prisma can match against dayOfWeek", () => {
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 0, 4 + i);
      for (const when of ["today", "tomorrow"]) {
        const got = dayOfWeekFor(when, d);
        expect(got).toBeGreaterThanOrEqual(0);
        expect(got).toBeLessThanOrEqual(6);
      }
    }
  });
});
