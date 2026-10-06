import { describe, expect, it } from "vitest";

import { formatWhen } from "./when";

describe("formatWhen", () => {
  it("writes a date that still reads correctly months later", () => {
    // Stored into a notification, so it must not say "tomorrow".
    expect(formatWhen(new Date(Date.UTC(2026, 9, 7)), "14:00")).toBe(
      "الأربعاء، 7 أكتوبر — 14:00",
    );
  });

  it("reads the date in UTC, matching how bookings store it", () => {
    // A booking's date is UTC midnight; reading it with local getters
    // would shift it a day for anyone west of Greenwich.
    expect(formatWhen(new Date("2026-01-01T00:00:00Z"), "09:30")).toContain("1 يناير");
  });

  it("covers every weekday and month without falling off the end", () => {
    for (let i = 0; i < 370; i += 7) {
      const d = new Date(Date.UTC(2026, 0, 1 + i));
      const out = formatWhen(d, "10:00");
      expect(out).not.toContain("undefined");
      expect(out).toMatch(/^[^،]+، \d{1,2} .+ — 10:00$/);
    }
  });
});
