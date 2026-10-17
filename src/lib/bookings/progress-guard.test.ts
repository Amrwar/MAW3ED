import { describe, expect, it } from "vitest";
import { ARRIVE_EARLY_MINUTES, allowedNow, isTooEarly } from "./progress-guard";

// 2026-10-14 10:00 in Cairo (UTC+3 under summer time) is 07:00Z.
const now = new Date("2026-10-14T07:00:00Z");
const at = (date: string, startTime: string) => ({ date: new Date(`${date}T00:00:00Z`), startTime });

describe("the day-of moves are tied to the clock", () => {
  it("refuses COMPLETED and NO_SHOW before the start", () => {
    const tomorrow = at("2026-10-15", "10:00");
    expect(isTooEarly("COMPLETED", tomorrow, now)).toBe(true);
    expect(isTooEarly("NO_SHOW", tomorrow, now)).toBe(true);
    expect(isTooEarly("COMPLETED", at("2026-10-14", "10:01"), now)).toBe(true);
  });

  it("allows COMPLETED and NO_SHOW from the start on", () => {
    expect(isTooEarly("COMPLETED", at("2026-10-14", "10:00"), now)).toBe(false);
    expect(isTooEarly("NO_SHOW", at("2026-10-13", "18:00"), now)).toBe(false);
  });

  it(`allows ARRIVED and IN_PROGRESS from ${ARRIVE_EARLY_MINUTES} minutes before the start`, () => {
    expect(isTooEarly("ARRIVED", at("2026-10-14", "10:30"), now)).toBe(false);
    expect(isTooEarly("IN_PROGRESS", at("2026-10-14", "10:30"), now)).toBe(false);
    expect(isTooEarly("ARRIVED", at("2026-10-14", "10:31"), now)).toBe(true);
  });

  it("never time-bounds CONFIRMED or CANCELLED", () => {
    expect(isTooEarly("CONFIRMED", at("2027-01-01", "10:00"), now)).toBe(false);
    expect(isTooEarly("CANCELLED", at("2027-01-01", "10:00"), now)).toBe(false);
  });

  it("prefers startsAt when the row has one", () => {
    const b = { ...at("2026-10-15", "10:00"), startsAt: new Date("2026-10-14T09:00:00Z") };
    expect(isTooEarly("COMPLETED", b, now)).toBe(false);
  });

  it("filters an actions list", () => {
    const all = ["ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
    expect(allowedNow(all, at("2026-10-20", "10:00"), now)).toEqual(["CANCELLED"]);
    expect(allowedNow(all, at("2026-10-14", "10:15"), now)).toEqual(["ARRIVED", "IN_PROGRESS", "CANCELLED"]);
    expect(allowedNow(all, at("2026-10-14", "09:00"), now)).toEqual([...all]);
  });
});
