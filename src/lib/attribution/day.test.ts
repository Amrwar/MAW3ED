import { describe, it, expect } from "vitest";
import { cairoDay, cairoDayBefore } from "./day";

describe("cairoDay", () => {
  it("is midnight UTC, so the DATE column stores the date part cleanly", () => {
    const d = cairoDay(new Date("2026-10-07T09:00:00Z"));
    expect(d.toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });

  it("files a late Cairo evening under that evening's day", () => {
    // 23:00 Cairo on the 7th is 20:00 or 21:00 UTC on the 7th.
    expect(cairoDay(new Date("2026-10-07T20:30:00Z")).toISOString()).toBe(
      "2026-10-07T00:00:00.000Z",
    );
  });

  it("files the small hours under the new day, not the previous one", () => {
    // 01:00 Cairo on the 8th is 22:00 UTC on the 7th. Treating that as
    // the 7th moves a whole evening of traffic into yesterday's row.
    const d = cairoDay(new Date("2026-10-07T22:30:00Z"));
    expect(d.toISOString()).toBe("2026-10-08T00:00:00.000Z");
  });

  it("agrees with itself across the summer-time boundary", () => {
    // Egypt runs summer time; the offset is not a constant. Whatever it
    // is on the day, the same instant must always map to one day.
    for (const iso of [
      "2026-01-15T22:30:00Z",
      "2026-06-15T21:30:00Z",
      "2026-10-07T22:30:00Z",
    ]) {
      const a = cairoDay(new Date(iso));
      const b = cairoDay(new Date(iso));
      expect(a.getTime()).toBe(b.getTime());
      expect(a.toISOString()).toMatch(/T00:00:00\.000Z$/);
    }
  });
});

describe("cairoDayBefore", () => {
  it("steps back whole days", () => {
    const now = new Date("2026-10-07T09:00:00Z");
    expect(cairoDayBefore(0, now).toISOString()).toBe("2026-10-07T00:00:00.000Z");
    expect(cairoDayBefore(1, now).toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(cairoDayBefore(30, now).toISOString()).toBe("2026-09-07T00:00:00.000Z");
  });
});
