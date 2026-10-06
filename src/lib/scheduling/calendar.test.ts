import { describe, expect, it } from "vitest";

import { datesBetween, layoutDay, parseView, rangeFor } from "./calendar";

describe("parseView", () => {
  it("accepts the three views", () => {
    expect(parseView("day")).toBe("day");
    expect(parseView("week")).toBe("week");
    expect(parseView("month")).toBe("month");
  });

  it("falls back to day for anything else", () => {
    expect(parseView(undefined)).toBe("day");
    expect(parseView("year")).toBe("day");
    expect(parseView("WEEK")).toBe("day");
  });
});

describe("rangeFor", () => {
  it("covers one day in the day view", () => {
    expect(rangeFor("day", "2026-03-10")).toEqual({ from: "2026-03-10", to: "2026-03-10" });
  });

  it("starts the week on Saturday, as Egypt does", () => {
    // 2026-03-10 is a Tuesday; the week it sits in runs Sat 7 – Fri 13.
    expect(rangeFor("week", "2026-03-10")).toEqual({ from: "2026-03-07", to: "2026-03-13" });
  });

  it("keeps a Saturday in its own week rather than the previous one", () => {
    expect(rangeFor("week", "2026-03-07")).toEqual({ from: "2026-03-07", to: "2026-03-13" });
  });

  it("puts a Friday at the end of its week", () => {
    expect(rangeFor("week", "2026-03-13")).toEqual({ from: "2026-03-07", to: "2026-03-13" });
  });

  it("pads the month out to whole weeks", () => {
    // March 2026 starts on a Sunday and ends on a Tuesday, so the grid
    // reaches back to Saturday 28 February and on to Friday 3 April.
    expect(rangeFor("month", "2026-03-10")).toEqual({ from: "2026-02-28", to: "2026-04-03" });
  });

  it("always returns a whole number of weeks for a month", () => {
    for (const anchor of ["2026-01-15", "2026-02-15", "2026-06-01", "2026-11-30", "2024-02-29"]) {
      const { from, to } = rangeFor("month", anchor);
      expect(datesBetween(from, to).length % 7).toBe(0);
    }
  });
});

describe("datesBetween", () => {
  it("includes both ends", () => {
    expect(datesBetween("2026-03-10", "2026-03-12")).toEqual([
      "2026-03-10",
      "2026-03-11",
      "2026-03-12",
    ]);
  });

  it("returns a single day for a single day", () => {
    expect(datesBetween("2026-03-10", "2026-03-10")).toEqual(["2026-03-10"]);
  });

  it("crosses a month boundary", () => {
    expect(datesBetween("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
  });

  it("crosses a leap day", () => {
    expect(datesBetween("2024-02-28", "2024-03-01")).toEqual([
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
    ]);
  });
});

describe("layoutDay", () => {
  const at = (startMin: number, endMin: number, id = `${startMin}`) => ({ startMin, endMin, id });

  it("gives a lone appointment the whole width", () => {
    const out = layoutDay([at(600, 660)]);
    expect(out).toEqual([{ entry: at(600, 660), column: 0, columns: 1 }]);
  });

  it("keeps consecutive appointments in one column", () => {
    const out = layoutDay([at(600, 660), at(660, 720)]);
    expect(out.map((o) => o.columns)).toEqual([1, 1]);
    expect(out.map((o) => o.column)).toEqual([0, 0]);
  });

  it("puts two overlapping appointments side by side", () => {
    const out = layoutDay([at(600, 700), at(630, 730)]);
    expect(out.map((o) => o.columns)).toEqual([2, 2]);
    expect(out.map((o) => o.column).sort()).toEqual([0, 1]);
  });

  it("shows a genuine double booking as two columns rather than hiding one", () => {
    const out = layoutDay([at(600, 660, "a"), at(600, 660, "b")]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((o) => o.column)).size).toBe(2);
  });

  it("reuses a column once its appointment has finished", () => {
    // 10:00–11:00 and 10:30–11:30 overlap; 11:00–12:00 can reuse the
    // first column because that one is free again.
    const out = layoutDay([at(600, 660), at(630, 690), at(660, 720)]);
    expect(out.every((o) => o.columns === 2)).toBe(true);
  });

  it("separates clusters that do not touch", () => {
    const out = layoutDay([at(600, 660), at(630, 690), at(900, 960)]);
    const lone = out.find((o) => o.entry.startMin === 900);
    expect(lone?.columns).toBe(1);
  });

  it("handles an empty day", () => {
    expect(layoutDay([])).toEqual([]);
  });

  it("never places two appointments in the same column at the same time", () => {
    const entries = [at(600, 700), at(610, 720), at(615, 630), at(690, 760), at(800, 900)];
    const out = layoutDay(entries);
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        if (out[i].column !== out[j].column) continue;
        const a = out[i].entry;
        const b = out[j].entry;
        expect(a.startMin < b.endMin && a.endMin > b.startMin).toBe(false);
      }
    }
  });
});
