import type { ReviewStatus } from "@prisma/client";

/**
 * Who may write, change or withdraw a review, and until when.
 *
 * Written down in one place because every one of these is a judgement
 * call that somebody will eventually argue about, and a rule nobody can
 * find is a rule that gets applied differently twice.
 */

/**
 * How long after posting the author may rewrite or withdraw it.
 *
 * Fourteen days is long enough to fix a sentence written in temper or
 * to withdraw one left by mistake, and short enough that a business
 * cannot pressure somebody into changing a review months later — which
 * is the thing an unlimited window actually enables.
 */
export const EDIT_WINDOW_DAYS = 14;

/**
 * How long after the appointment a review may still be written.
 *
 * Ninety days. Past that the memory is not of the visit any more, and a
 * platform that accepts year-old reviews accepts reviews bought in bulk
 * against old bookings.
 */
export const REVIEW_WINDOW_DAYS = 90;

export type EligibilityReason =
  | "ok"
  | "not-completed"
  | "already-reviewed"
  | "too-late";

/**
 * Whether this booking may be reviewed.
 *
 * Completed, not already reviewed, and not too long ago. The unique
 * constraint on Review.bookingId enforces the second of those whatever
 * this says; this exists to tell somebody before they type.
 */
export function canReviewBooking(
  b: {
    status: string;
    review?: { id: string } | null;
    /** The appointment's end, or its date when there is no instant. */
    endsAt?: Date | null;
    date?: Date | null;
  },
  now: Date = new Date(),
): { allowed: boolean; reason: EligibilityReason } {
  if (b.review) return { allowed: false, reason: "already-reviewed" };
  if (b.status !== "COMPLETED") return { allowed: false, reason: "not-completed" };

  const finished = b.endsAt ?? b.date ?? null;
  if (finished) {
    const age = now.getTime() - finished.getTime();
    if (age > REVIEW_WINDOW_DAYS * 86_400_000) {
      return { allowed: false, reason: "too-late" };
    }
  }

  return { allowed: true, reason: "ok" };
}

export type EditReason = "ok" | "window-closed" | "moderated" | "withdrawn";

/**
 * Whether the author may still change or withdraw their review.
 *
 * A review a moderator has acted on is not editable: letting an author
 * rewrite a hidden review would be a way to launder it back into view.
 */
export function canEditReview(
  r: { createdAt: Date; status: ReviewStatus },
  now: Date = new Date(),
): { allowed: boolean; reason: EditReason } {
  if (r.status === "REMOVED") return { allowed: false, reason: "withdrawn" };
  if (r.status === "HIDDEN") return { allowed: false, reason: "moderated" };

  const age = now.getTime() - r.createdAt.getTime();
  if (age > EDIT_WINDOW_DAYS * 86_400_000) {
    return { allowed: false, reason: "window-closed" };
  }
  return { allowed: true, reason: "ok" };
}

/**
 * Withdrawing is not deleting.
 *
 * The row stays, with status REMOVED: it stops appearing and stops
 * counting, but the booking it belongs to keeps its one-review-only
 * constraint, so withdrawing cannot be used to post a second review of
 * the same visit. It also leaves a moderator something to look at when
 * a business complains that a review vanished.
 */
export const WITHDRAWN_STATUS: ReviewStatus = "REMOVED";

/** Days left in the edit window, for telling the author. */
export function editDaysLeft(createdAt: Date, now: Date = new Date()): number {
  const used = (now.getTime() - createdAt.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(EDIT_WINDOW_DAYS - used));
}

/* ─── Moderation ─────────────────────────────────────────── */

export type ModerationAction = "approve" | "hide" | "investigate" | "restore" | "flag";

/**
 * What each action does to a review.
 *
 * "approve" and "restore" both end at PUBLISHED but mean different
 * things to the person doing them: approve answers a report, restore
 * undoes a hiding. Keeping both is worth one duplicated value.
 */
export const ACTION_RESULT: Record<ModerationAction, ReviewStatus> = {
  approve: "PUBLISHED",
  restore: "PUBLISHED",
  hide: "HIDDEN",
  investigate: "UNDER_REVIEW",
  flag: "UNDER_REVIEW",
};

/**
 * Whether an action makes sense from where the review is now.
 *
 * Restoring something already published, or approving something nobody
 * questioned, is a no-op that would still write a moderation record and
 * make the log harder to read.
 */
export function canModerate(
  current: ReviewStatus,
  action: ModerationAction,
): boolean {
  switch (action) {
    case "approve":
      return current === "UNDER_REVIEW";
    case "restore":
      return current === "HIDDEN";
    case "hide":
      return current !== "HIDDEN";
    case "investigate":
    case "flag":
      return current === "PUBLISHED";
  }
}
