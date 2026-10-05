import { describe, expect, it } from "vitest";

import { canReviewBooking, parseRatingFilter, parseReviewSort } from "./reviews";

describe("parseReviewSort", () => {
  it("accepts the four orderings the UI offers", () => {
    for (const s of ["recent", "highest", "lowest", "helpful"]) {
      expect(parseReviewSort(s)).toBe(s);
    }
  });

  it("falls back to most-recent for anything else", () => {
    expect(parseReviewSort(undefined)).toBe("recent");
    expect(parseReviewSort("")).toBe("recent");
    expect(parseReviewSort("best")).toBe("recent");
    expect(parseReviewSort("RECENT")).toBe("recent");
  });
});

describe("parseRatingFilter", () => {
  it("accepts the five star buckets", () => {
    for (let n = 1; n <= 5; n++) expect(parseRatingFilter(String(n))).toBe(n);
  });

  it("rejects anything outside them", () => {
    expect(parseRatingFilter(undefined)).toBeNull();
    expect(parseRatingFilter("0")).toBeNull();
    expect(parseRatingFilter("6")).toBeNull();
    expect(parseRatingFilter("-1")).toBeNull();
    expect(parseRatingFilter("4.5")).toBeNull();
    expect(parseRatingFilter("five")).toBeNull();
  });
});

describe("canReviewBooking", () => {
  it("allows a completed booking that has not been reviewed", () => {
    expect(canReviewBooking({ status: "COMPLETED", review: null })).toEqual({
      allowed: true,
      reason: "ok",
    });
  });

  it("refuses an appointment that has not happened yet", () => {
    for (const status of ["PENDING", "CONFIRMED"]) {
      expect(canReviewBooking({ status, review: null })).toEqual({
        allowed: false,
        reason: "not-completed",
      });
    }
  });

  it("refuses one that was cancelled or missed, so a no-show cannot rate", () => {
    for (const status of ["CANCELLED", "NO_SHOW", "FAILED_PAYMENT"]) {
      expect(canReviewBooking({ status, review: null }).allowed).toBe(false);
    }
  });

  it("refuses a second review of the same visit", () => {
    expect(canReviewBooking({ status: "COMPLETED", review: { id: "r1" } })).toEqual({
      allowed: false,
      reason: "already-reviewed",
    });
  });

  it("reports already-reviewed ahead of not-completed, which is the more useful message", () => {
    expect(canReviewBooking({ status: "CANCELLED", review: { id: "r1" } }).reason).toBe(
      "already-reviewed",
    );
  });
});
