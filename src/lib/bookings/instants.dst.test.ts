import { describe, expect, it } from "vitest";
import {
  bookingInstants,
  bookingStartInstant,
  cairoDayEnd,
  cairoDayStart,
  cairoWallClock,
  wallToInstant,
  zoneOffsetMinutes,
  zonedDayEnd,
  zonedDayStart,
} from "./instants";

/**
 * Egypt's summer time, 2026: clocks go forward at 00:00 on Friday 24
 * April (to 01:00, UTC+3) and back at 24:00 on Thursday 29 October (to
 * 23:00, UTC+2). None of these numbers appear in instants.ts: they come
 * from the platform's zone data, and this file checks the arithmetic
 * built on it at exactly the moments it is hardest.
 */
describe("zone offsets come from the zone data, not a constant", () => {
  it("knows winter from summer", () => {
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"))).toBe(120);
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"))).toBe(180);
  });

  it("changes at the transition instant, not the calendar day", () => {
    // 21:59:59Z on 23 April is 23:59:59 +02; a second later it is 01:00 +03.
    expect(zoneOffsetMinutes(new Date("2026-04-23T21:59:59Z"))).toBe(120);
    expect(zoneOffsetMinutes(new Date("2026-04-23T22:00:00Z"))).toBe(180);
    // 20:59:59Z on 29 October is 23:59:59 +03; a second later it is 23:00 +02.
    expect(zoneOffsetMinutes(new Date("2026-10-29T20:59:59Z"))).toBe(180);
    expect(zoneOffsetMinutes(new Date("2026-10-29T21:00:00Z"))).toBe(120);
  });

  it("answers for another zone the same way", () => {
    expect(zoneOffsetMinutes(new Date("2026-07-15T12:00:00Z"), "Asia/Riyadh")).toBe(180);
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "Asia/Dubai")).toBe(240);
    expect(zoneOffsetMinutes(new Date("2026-01-15T12:00:00Z"), "UTC")).toBe(0);
  });
});

describe("the day the clocks go forward (Friday 24 April 2026)", () => {
  const during = new Date("2026-04-24T10:00:00Z");

  it("starts at the first instant that exists on that date — 01:00, since 00:00 was skipped", () => {
    const start = cairoDayStart(during);
    expect(start.toISOString()).toBe("2026-04-23T22:00:00.000Z");
    expect(zoneOffsetMinutes(start)).toBe(180);
  });

  it("is 23 hours long", () => {
    expect(cairoDayEnd(during).getTime() - cairoDayStart(during).getTime()).toBe(23 * 3_600_000);
  });

  it("moves a time inside the skipped hour forward by the skip", () => {
    // "00:30" never happened; the clock went from 00:00 to 01:00. An
    // appointment written at 00:30 is honoured at 01:30 (+3), as a
    // calendar would, and the day's first instant is 01:00 (+3).
    expect(wallToInstant("2026-04-24", 30).toISOString()).toBe("2026-04-23T22:30:00.000Z");
    expect(wallToInstant("2026-04-24", 0).toISOString()).toBe("2026-04-23T22:00:00.000Z");
    expect(wallToInstant("2026-04-24", 60).toISOString()).toBe("2026-04-23T22:00:00.000Z");
  });

  it("places 14:00 that afternoon at 11:00Z (+3), not 12:00Z (+2)", () => {
    expect(wallToInstant("2026-04-24", 14 * 60).toISOString()).toBe("2026-04-24T11:00:00.000Z");
  });
});

describe("the day the clocks go back (Thursday 29 October 2026)", () => {
  const during = new Date("2026-10-29T10:00:00Z");

  it("is 25 hours long", () => {
    expect(cairoDayStart(during).toISOString()).toBe("2026-10-28T21:00:00.000Z");
    expect(cairoDayEnd(during).toISOString()).toBe("2026-10-29T22:00:00.000Z");
    expect(cairoDayEnd(during).getTime() - cairoDayStart(during).getTime()).toBe(25 * 3_600_000);
  });

  it("ends exactly where the next day begins", () => {
    expect(cairoDayEnd(during).getTime()).toBe(cairoDayStart(new Date("2026-10-30T10:00:00Z")).getTime());
  });

  it("resolves the repeated hour to its first occurrence", () => {
    // 23:30 happens twice that night: at 20:30Z (+3) and at 21:30Z (+2).
    expect(wallToInstant("2026-10-29", 23 * 60 + 30).toISOString()).toBe("2026-10-29T20:30:00.000Z");
  });

  it("puts an appointment the next morning on the winter offset", () => {
    expect(bookingStartInstant({ date: new Date("2026-10-30T00:00:00Z"), startTime: "09:00" }).toISOString())
      .toBe("2026-10-30T07:00:00.000Z");
    // And the morning before on the summer one.
    expect(bookingStartInstant({ date: new Date("2026-10-29T00:00:00Z"), startTime: "09:00" }).toISOString())
      .toBe("2026-10-29T06:00:00.000Z");
  });
});

describe("the wall-clock frame is unmoved by the change", () => {
  it("stores 14:00 as 14:00 on both sides of it", () => {
    const before = bookingInstants("2026-10-29", "14:00", "15:00", 60);
    const after = bookingInstants("2026-10-30", "14:00", "15:00", 60);
    expect(before.startsAt.toISOString()).toBe("2026-10-29T14:00:00.000Z");
    expect(after.startsAt.toISOString()).toBe("2026-10-30T14:00:00.000Z");
  });

  it("reads the same wall clock on both sides as the stored frame", () => {
    // 11:00Z on the 29th is 14:00 Cairo (+3); 12:00Z on the 30th is 14:00 Cairo (+2).
    expect(cairoWallClock(new Date("2026-10-29T11:00:00Z")).toISOString()).toBe("2026-10-29T14:00:00.000Z");
    expect(cairoWallClock(new Date("2026-10-30T12:00:00Z")).toISOString()).toBe("2026-10-30T14:00:00.000Z");
  });

  it("carries a cross-midnight booking into the next calendar day", () => {
    const { startsAt, endsAt } = bookingInstants("2026-10-29", "23:30", "25:00", 90);
    expect(startsAt.toISOString()).toBe("2026-10-29T23:30:00.000Z");
    expect(endsAt.toISOString()).toBe("2026-10-30T01:00:00.000Z");
  });

  it("repairs a legacy row whose end wrapped to the morning", () => {
    const { endsAt } = bookingInstants("2026-10-29", "23:30", "01:00", 90);
    expect(endsAt.toISOString()).toBe("2026-10-30T01:00:00.000Z");
  });
});

describe("another zone through the same functions", () => {
  it("gives Riyadh its own midnight", () => {
    const start = zonedDayStart(new Date("2026-04-24T10:00:00Z"), "Asia/Riyadh");
    expect(start.toISOString()).toBe("2026-04-23T21:00:00.000Z");
    expect(zonedDayEnd(new Date("2026-04-24T10:00:00Z"), "Asia/Riyadh").getTime() - start.getTime()).toBe(24 * 3_600_000);
  });
});
