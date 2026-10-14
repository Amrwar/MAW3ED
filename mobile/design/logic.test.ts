import { describe, it, expect, vi } from "vitest";
import { addDays, addMonths, cairoToday, monthGrid, weekdayHeaders, weekdayOf } from "./calendar";
import { layoutFor } from "./layout";
import { money, time, duration, weekdayHeading, relativeTime } from "@/lib/format";

vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("react-native", () => ({ StyleSheet: { create: (s: unknown) => s }, View: () => null }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
const { isDirectional } = await import("./components/Icon");

describe("calendar", () => {
  it("lays October 2026 out in Egyptian weeks, Saturday first", () => {
    const weeks = monthGrid("2026-10-15");
    // 1 October 2026 is a Thursday: Sat Sun Mon Tue Wed are blank.
    expect(weeks[0]).toEqual([null, null, null, null, null, "2026-10-01", "2026-10-02"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("can start the week on Sunday", () => {
    expect(monthGrid("2026-10-01", 0)[0]?.[4]).toBe("2026-10-01");
  });

  it("names the columns in grid order", () => {
    expect(weekdayHeaders().map(weekdayOf)).toEqual([6, 0, 1, 2, 3, 4, 5]);
  });

  it("does arithmetic without timezone drift", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("knows today in Cairo, not on the phone's clock", () => {
    // 22:30 UTC on 12 Oct is 01:30 on 13 Oct in Cairo (UTC+3).
    expect(cairoToday(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });
});

describe("layout", () => {
  it("is one column on a phone, two on a small tablet, three on a large one", () => {
    expect(layoutFor(375, 667).columns).toBe(1);
    expect(layoutFor(768, 1024).columns).toBe(2);
    expect(layoutFor(1194, 834).columns).toBe(3);
  });

  it("stops content growing on a tablet", () => {
    expect(layoutFor(1194, 834).contentWidth).toBeLessThanOrEqual(720);
    expect(layoutFor(375, 667).contentWidth).toBe(375 - 32);
  });
});

describe("formatting in both languages", () => {
  it("keeps Latin digits in Arabic, as the web does", () => {
    expect(money(1850, "EGP", "ar")).toBe("1,850 ج.م");
    expect(money(1850, "EGP", "en")).toBe("EGP 1,850");
    expect(money(null)).toBeNull();
  });

  it("writes times for each language", () => {
    expect(time("14:30", "ar")).toBe("2:30 م");
    expect(time("09:05", "en")).toBe("9:05 AM");
  });

  it("writes durations and relative times", () => {
    expect(duration(75, "en")).toBe("1 hr 15 min");
    expect(duration(120, "ar")).toBe("ساعتين");
    expect(relativeTime(60 * 24, "en")).toBe("tomorrow");
  });

  it("gives seven distinct Arabic weekday headings", () => {
    const headings = weekdayHeaders().map((d) => weekdayHeading(d, "ar"));
    expect(new Set(headings).size).toBe(7);
  });
});

describe("icons", () => {
  it("mirrors arrows in RTL but never objects", () => {
    expect(isDirectional("chevron-forward")).toBe(true);
    expect(isDirectional("arrow-back-outline")).toBe(true);
    expect(isDirectional("calendar-outline")).toBe(false);
    expect(isDirectional("time-outline")).toBe(false);
  });
});
