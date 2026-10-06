import { describe, expect, it } from "vitest";

import {
  ACTION_RESULT,
  EDIT_WINDOW_DAYS,
  REVIEW_WINDOW_DAYS,
  canEditReview,
  canModerate,
  canReviewBooking,
  editDaysLeft,
} from "./review-policy";

const NOW = new Date("2026-10-06T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe("who may write a review", () => {
  it("lets somebody review an appointment they attended", () => {
    expect(
      canReviewBooking({ status: "COMPLETED", endsAt: daysAgo(2) }, NOW),
    ).toEqual({ allowed: true, reason: "ok" });
  });

  it("refuses an appointment that has not happened", () => {
    for (const status of ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"]) {
      expect(canReviewBooking({ status, endsAt: daysAgo(2) }, NOW).reason).toBe(
        "not-completed",
      );
    }
  });

  it("refuses a second review of the same visit", () => {
    expect(
      canReviewBooking(
        { status: "COMPLETED", endsAt: daysAgo(2), review: { id: "r1" } },
        NOW,
      ).reason,
    ).toBe("already-reviewed");
  });

  it("reports an existing review before it reports anything else", () => {
    // Somebody who already reviewed should be told that, not told their
    // appointment was never completed.
    expect(
      canReviewBooking(
        { status: "PENDING", endsAt: daysAgo(500), review: { id: "r1" } },
        NOW,
      ).reason,
    ).toBe("already-reviewed");
  });

  it("closes the window long after the visit", () => {
    expect(
      canReviewBooking(
        { status: "COMPLETED", endsAt: daysAgo(REVIEW_WINDOW_DAYS + 1) },
        NOW,
      ).reason,
    ).toBe("too-late");
  });

  it("is still open on the last day of the window", () => {
    expect(
      canReviewBooking(
        { status: "COMPLETED", endsAt: daysAgo(REVIEW_WINDOW_DAYS - 1) },
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it("falls back to the date when a booking has no instant", () => {
    // Rows written before startsAt/endsAt existed still have a date.
    expect(
      canReviewBooking({ status: "COMPLETED", date: daysAgo(1) }, NOW).allowed,
    ).toBe(true);
    expect(
      canReviewBooking(
        { status: "COMPLETED", date: daysAgo(REVIEW_WINDOW_DAYS + 5) },
        NOW,
      ).reason,
    ).toBe("too-late");
  });

  it("allows a completed booking with no date at all rather than guessing", () => {
    expect(canReviewBooking({ status: "COMPLETED" }, NOW).allowed).toBe(true);
  });
});

describe("who may change one", () => {
  it("lets the author rewrite it inside the window", () => {
    expect(
      canEditReview({ createdAt: daysAgo(3), status: "PUBLISHED" }, NOW),
    ).toEqual({ allowed: true, reason: "ok" });
  });

  it("closes the window after two weeks", () => {
    expect(
      canEditReview({ createdAt: daysAgo(EDIT_WINDOW_DAYS + 1), status: "PUBLISHED" }, NOW)
        .reason,
    ).toBe("window-closed");
  });

  it("will not let a hidden review be rewritten back into view", () => {
    // Otherwise hiding a review would be undone by editing it.
    expect(
      canEditReview({ createdAt: daysAgo(1), status: "HIDDEN" }, NOW).reason,
    ).toBe("moderated");
  });

  it("will not reopen a withdrawn one", () => {
    expect(
      canEditReview({ createdAt: daysAgo(1), status: "REMOVED" }, NOW).reason,
    ).toBe("withdrawn");
  });

  it("still allows editing while a report is being looked at", () => {
    // A reported review is not yet a judged one.
    expect(
      canEditReview({ createdAt: daysAgo(1), status: "UNDER_REVIEW" }, NOW).allowed,
    ).toBe(true);
  });

  it("counts down the days honestly", () => {
    expect(editDaysLeft(daysAgo(0), NOW)).toBe(EDIT_WINDOW_DAYS);
    expect(editDaysLeft(daysAgo(13), NOW)).toBe(1);
    expect(editDaysLeft(daysAgo(14), NOW)).toBe(0);
    expect(editDaysLeft(daysAgo(99), NOW)).toBe(0);
  });
});

describe("moderation", () => {
  it("ends each action in the right place", () => {
    expect(ACTION_RESULT.approve).toBe("PUBLISHED");
    expect(ACTION_RESULT.restore).toBe("PUBLISHED");
    expect(ACTION_RESULT.hide).toBe("HIDDEN");
    expect(ACTION_RESULT.investigate).toBe("UNDER_REVIEW");
    expect(ACTION_RESULT.flag).toBe("UNDER_REVIEW");
  });

  it("only approves something that was questioned", () => {
    expect(canModerate("UNDER_REVIEW", "approve")).toBe(true);
    expect(canModerate("PUBLISHED", "approve")).toBe(false);
  });

  it("only restores something that was hidden", () => {
    expect(canModerate("HIDDEN", "restore")).toBe(true);
    expect(canModerate("PUBLISHED", "restore")).toBe(false);
    expect(canModerate("UNDER_REVIEW", "restore")).toBe(false);
  });

  it("can hide anything that is not already hidden", () => {
    expect(canModerate("PUBLISHED", "hide")).toBe(true);
    expect(canModerate("UNDER_REVIEW", "hide")).toBe(true);
    expect(canModerate("HIDDEN", "hide")).toBe(false);
  });

  it("only opens an investigation on something currently published", () => {
    expect(canModerate("PUBLISHED", "investigate")).toBe(true);
    expect(canModerate("UNDER_REVIEW", "investigate")).toBe(false);
    expect(canModerate("HIDDEN", "flag")).toBe(false);
  });
});
