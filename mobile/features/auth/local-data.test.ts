import { describe, expect, it } from "vitest";
import { isPersonalKey } from "./local-data";

describe("what is forgotten on sign-out", () => {
  it("booking drafts, unfinished payments and searches", () => {
    expect(isPersonalKey("maw3ed.booking.qa-salon")).toBe(true);
    expect(isPersonalKey("maw3ed.booking.attempt.qa-salon")).toBe(true);
    expect(isPersonalKey("maw3ed.pay.abcdef0123456789")).toBe(true);
    expect(isPersonalKey("maw3ed.recentSearches")).toBe(true);
  });
  it("not the phone's own settings", () => {
    expect(isPersonalKey("maw3ed.lang")).toBe(false);
    expect(isPersonalKey("maw3ed.homeCity")).toBe(false);
    expect(isPersonalKey("REACT_QUERY_OFFLINE_CACHE")).toBe(false);
  });
});
