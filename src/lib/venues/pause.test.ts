import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { pauseApplies } from "./pause";

describe("pauseApplies", () => {
  it("a whole-business listing pauses every booking", () => {
    expect(pauseApplies([{ branchId: null }], null, 3)).toBe(true);
    expect(pauseApplies([{ branchId: null }], "b1", 3)).toBe(true);
  });
  it("a branch listing pauses that branch only", () => {
    expect(pauseApplies([{ branchId: "b1" }], "b1", 3)).toBe(true);
    expect(pauseApplies([{ branchId: "b1" }], "b2", 3)).toBe(false);
  });
  it("a single-location business is paused for bookings that carry no branch", () => {
    expect(pauseApplies([{ branchId: "b1" }], null, 1)).toBe(true);
    expect(pauseApplies([{ branchId: "b1" }], null, 2)).toBe(false);
  });
  it("nothing listed, nothing paused", () => {
    expect(pauseApplies([], null, 0)).toBe(false);
  });
});
