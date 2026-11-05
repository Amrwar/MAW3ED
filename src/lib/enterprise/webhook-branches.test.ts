import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, error: () => undefined, info: () => undefined } }));

import { bookingStillVisible } from "./webhooks";

/**
 * Queued booking deliveries are re-checked against the grant's branches
 * at send time (final audit F-24): narrowing a grant from the whole
 * business to branch X stops what was queued about branch Y.
 */
describe("bookingStillVisible", () => {
  const grants = new Map<string, string[] | null>([
    ["whole", null],
    ["narrow", ["x"]],
  ]);

  it("sends any branch of a whole-business grant", () => {
    expect(bookingStillVisible(grants, "whole", "y")).toBe(true);
    expect(bookingStillVisible(grants, "whole", null)).toBe(true);
  });

  it("sends only the granted branches of a narrowed grant", () => {
    expect(bookingStillVisible(grants, "narrow", "x")).toBe(true);
    expect(bookingStillVisible(grants, "narrow", "y")).toBe(false);
    expect(bookingStillVisible(grants, "narrow", null)).toBe(false);
  });

  it("sends nothing for a business no longer granted", () => {
    expect(bookingStillVisible(grants, "gone", "x")).toBe(false);
  });
});
