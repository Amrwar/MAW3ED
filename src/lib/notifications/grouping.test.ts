import { describe, expect, it } from "vitest";

import { bucketFor, groupByDay } from "./grouping";

/** Cairo is UTC+2 in winter, UTC+3 under summer time. */
const at = (iso: string) => new Date(iso);

describe("bucketFor", () => {
  // 2026-10-06 10:00 Cairo (UTC+3 in October, under summer time).
  const now = at("2026-10-06T07:00:00Z");

  it("puts this morning in today", () => {
    expect(bucketFor(at("2026-10-06T06:00:00Z"), now)).toBe("today");
  });

  it("puts last night in yesterday, not in today", () => {
    // 23:50 Cairo on the 5th. Only ten minutes before midnight, but it
    // is not today, and a list that said so would read as wrong.
    expect(bucketFor(at("2026-10-05T20:50:00Z"), now)).toBe("yesterday");
  });

  it("counts the Cairo day, not the UTC one", () => {
    // 01:00 Cairo on the 6th is 22:00 UTC on the 5th. Bucketing by UTC
    // would call this yesterday for everybody in Egypt.
    expect(bucketFor(at("2026-10-05T22:00:00Z"), now)).toBe("today");
  });

  it("puts anything older in earlier", () => {
    expect(bucketFor(at("2026-10-04T12:00:00Z"), now)).toBe("earlier");
    expect(bucketFor(at("2025-01-01T12:00:00Z"), now)).toBe("earlier");
  });

  it("steps back over the start of a month", () => {
    const firstOfNovember = at("2026-11-01T09:00:00Z"); // 11:00 Cairo
    expect(bucketFor(at("2026-10-31T12:00:00Z"), firstOfNovember)).toBe("yesterday");
  });

  it("steps back over the end of a year", () => {
    const newYear = at("2027-01-01T09:00:00Z");
    expect(bucketFor(at("2026-12-31T12:00:00Z"), newYear)).toBe("yesterday");
  });

  it("steps back across the end of summer time", () => {
    // Egypt ends summer time in late October; the day before is still
    // simply the day before.
    const after = at("2026-11-01T06:00:00Z");
    expect(bucketFor(at("2026-10-31T10:00:00Z"), after)).toBe("yesterday");
  });
});

describe("groupByDay", () => {
  const now = at("2026-10-06T07:00:00Z");

  it("keeps newest-first order inside each group", () => {
    const rows = [
      { id: "a", createdAt: at("2026-10-06T06:00:00Z") },
      { id: "b", createdAt: at("2026-10-06T05:00:00Z") },
      { id: "c", createdAt: at("2026-10-05T10:00:00Z") },
      { id: "d", createdAt: at("2026-10-01T10:00:00Z") },
    ];
    const groups = groupByDay(rows, now);
    expect(groups.map((g) => g.bucket)).toEqual(["today", "yesterday", "earlier"]);
    expect(groups[0].items.map((r) => r.id)).toEqual(["a", "b"]);
    expect(groups[1].items.map((r) => r.id)).toEqual(["c"]);
    expect(groups[2].items.map((r) => r.id)).toEqual(["d"]);
  });

  it("leaves out a group with nothing in it", () => {
    // No empty "yesterday" heading above an empty space.
    const groups = groupByDay(
      [
        { id: "a", createdAt: at("2026-10-06T06:00:00Z") },
        { id: "d", createdAt: at("2026-10-01T10:00:00Z") },
      ],
      now,
    );
    expect(groups.map((g) => g.bucket)).toEqual(["today", "earlier"]);
  });

  it("accepts dates that arrived as strings", () => {
    const groups = groupByDay([{ id: "a", createdAt: "2026-10-06T06:00:00Z" }], now);
    expect(groups[0].bucket).toBe("today");
  });

  it("returns nothing for nothing", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
