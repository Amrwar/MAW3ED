import { describe, expect, it } from "vitest";

import { minutesToTime, overlaps, timeToMinutes } from "./time";

describe("timeToMinutes", () => {
  it("reads midnight as zero", () => {
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("reads a whole hour", () => {
    expect(timeToMinutes("09:00")).toBe(540);
  });

  it("reads hours and minutes together", () => {
    expect(timeToMinutes("14:30")).toBe(870);
  });

  it("reads the last minute of the day", () => {
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("reads a single-digit hour written with its leading zero", () => {
    expect(timeToMinutes("07:05")).toBe(425);
  });
});

describe("minutesToTime", () => {
  it("writes midnight with both padded fields", () => {
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("writes a whole hour", () => {
    expect(minutesToTime(540)).toBe("09:00");
  });

  it("writes hours and minutes", () => {
    expect(minutesToTime(870)).toBe("14:30");
  });

  it("pads a single-digit hour", () => {
    expect(minutesToTime(425)).toBe("07:05");
  });

  it("writes the last minute of the day", () => {
    expect(minutesToTime(1439)).toBe("23:59");
  });
});

describe("the two conversions together", () => {
  it("round-trip every quarter hour of the day", () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
      expect(timeToMinutes(minutesToTime(minutes))).toBe(minutes);
    }
  });

  it("round-trip a time string", () => {
    for (const time of ["00:00", "08:45", "12:00", "17:20", "23:59"]) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time);
    }
  });
});

describe("overlaps", () => {
  it("sees two bookings sharing the middle of an hour", () => {
    expect(overlaps(600, 660, 630, 690)).toBe(true);
  });

  it("sees a booking wholly inside another", () => {
    expect(overlaps(600, 720, 630, 660)).toBe(true);
  });

  it("sees a booking that swallows another", () => {
    expect(overlaps(630, 660, 600, 720)).toBe(true);
  });

  it("sees two bookings at exactly the same time", () => {
    expect(overlaps(600, 660, 600, 660)).toBe(true);
  });

  it("allows back-to-back bookings, the half-open rule", () => {
    // 10:00–11:00 then 11:00–12:00 is the common case and must be bookable.
    expect(overlaps(600, 660, 660, 720)).toBe(false);
  });

  it("allows back-to-back the other way round", () => {
    expect(overlaps(660, 720, 600, 660)).toBe(false);
  });

  it("leaves a clear gap alone", () => {
    expect(overlaps(600, 660, 700, 760)).toBe(false);
  });

  it("catches an overlap of a single minute", () => {
    expect(overlaps(600, 661, 660, 720)).toBe(true);
  });

  it("is the same answer whichever booking is named first", () => {
    const cases: Array<[number, number, number, number]> = [
      [600, 660, 630, 690],
      [600, 660, 660, 720],
      [600, 660, 700, 760],
      [630, 660, 600, 720],
    ];
    for (const [aStart, aEnd, bStart, bEnd] of cases) {
      expect(overlaps(aStart, aEnd, bStart, bEnd)).toBe(
        overlaps(bStart, bEnd, aStart, aEnd),
      );
    }
  });

  it("still reports a conflict for a zero-length booking inside another", () => {
    // Worth knowing rather than assuming: a half-open interval of no length
    // shares no minute with anything, so the doc comment above `overlaps`
    // would have it conflict with nothing. The comparison is `<` and `>`
    // against the OTHER interval's ends, so an empty interval strictly
    // inside another still reports true.
    //
    // Left as it behaves rather than "corrected": a booking whose end equals
    // its start should not exist, and making it conflict-free would let one
    // be written over any slot at all. Pinned so a change here is deliberate.
    expect(overlaps(600, 600, 540, 660)).toBe(true);
  });

  it("reports no conflict for a zero-length booking outside another", () => {
    expect(overlaps(700, 700, 540, 660)).toBe(false);
  });
});

describe("a working day of bookings", () => {
  const day: Array<[string, string]> = [
    ["09:00", "09:30"],
    ["09:30", "10:15"],
    ["10:15", "11:00"],
  ];

  it("lets a full back-to-back day stand without conflicts", () => {
    for (let i = 0; i < day.length; i += 1) {
      for (let j = i + 1; j < day.length; j += 1) {
        const [aStart, aEnd] = day[i];
        const [bStart, bEnd] = day[j];
        expect(
          overlaps(
            timeToMinutes(aStart),
            timeToMinutes(aEnd),
            timeToMinutes(bStart),
            timeToMinutes(bEnd),
          ),
        ).toBe(false);
      }
    }
  });

  it("refuses a booking dropped across two of them", () => {
    expect(
      overlaps(
        timeToMinutes("09:20"),
        timeToMinutes("09:40"),
        timeToMinutes(day[1][0]),
        timeToMinutes(day[1][1]),
      ),
    ).toBe(true);
  });
});
