import type { ReviewStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { ReviewSort } from "./review-sorts";

/**
 * Reviews, and the one calculation of a rating.
 *
 * Everything that shows a star — the listing card, the profile header,
 * the summary block, the structured data — reads its number from here.
 * There is no second formula and no stored value that can drift from
 * the reviews table, because the denormalised columns on Business are
 * written by recomputeBusinessRating below and by nothing else.
 *
 * A business with no reviews has `count: 0` and `average: null`. Not
 * zero: zero is a rating, "none" is the absence of one, and a profile
 * must never show both a count and an empty state.
 */

/**
 * The reviews that exist, as far as the public is concerned.
 *
 * Exported and used by every reader — the list, the count, the average,
 * the distribution, the business's own page and the search index. One
 * constant, so a review cannot be absent from the list and present in
 * the number above it.
 *
 * UNDER_REVIEW is included deliberately. Hiding a review the moment
 * somebody objects to it would turn the report button into a
 * censorship button: anybody could silence any review by clicking it.
 * A reported review stays up, and a person decides.
 */
export const VISIBLE_STATUSES = ["PUBLISHED", "UNDER_REVIEW"] as const satisfies readonly ReviewStatus[];

/** The filter clause every public query starts from. */
export const visibleWhere = { status: { in: [...VISIBLE_STATUSES] } };

// These moved to review-sorts.ts, which imports nothing, so a client
// component can read them without importing this module and dragging
// `db` across the boundary with it. Re-exported here so every existing
// server-side caller keeps working unchanged.
export {
  REVIEW_SORTS,
  parseReviewSort,
  parseRatingFilter,
} from "./review-sorts";
export type { ReviewSort };

export interface RatingSummary {
  /** Rounded to one decimal. null when nobody has reviewed. */
  average: number | null;
  count: number;
  /** Reviews per star, indexed 1..5. Always five entries. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export const EMPTY_SUMMARY: RatingSummary = {
  average: null,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

/**
 * The rating, computed from the reviews themselves.
 *
 * One grouped query. The average is derived from the same rows as the
 * distribution, so the headline figure and the bars can never disagree
 * — which is the failure the brief describes.
 */
export async function getRatingSummary(businessId: string): Promise<RatingSummary> {
  const grouped = await db.review.groupBy({
    by: ["rating"],
    where: { businessId, ...visibleWhere },
    _count: { _all: true },
  });

  if (grouped.length === 0) return EMPTY_SUMMARY;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingSummary["distribution"];
  let total = 0;
  let count = 0;

  for (const row of grouped) {
    const star = Math.min(5, Math.max(1, row.rating)) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += row._count._all;
    total += row.rating * row._count._all;
    count += row._count._all;
  }

  return {
    average: count > 0 ? Math.round((total / count) * 10) / 10 : null,
    count,
    distribution,
  };
}

export interface PublicReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** First name only. A review is not an invitation to be identified. */
  authorName: string;
  /**
   * True only when the booking behind this review was actually
   * completed. A review always has a booking — the schema requires one
   * — but a booking that was cancelled or never happened does not earn
   * the badge.
   */
  verifiedBooking: boolean;
  /** What the customer booked, when it is still on the menu. */
  serviceName: string | null;
  /** The day of the appointment this review is about, YYYY-MM-DD. */
  bookedOn: string | null;
  /** Cloudinary URLs the customer attached. */
  photos: string[];
  helpfulCount: number;
  /** Set when the author rewrote it; the page says so. */
  editedAt: string | null;
  response: { text: string; at: string } | null;
}

/** Shows "محمد ع." rather than the full name a booking was made under. */
function displayName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "عميل";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

const ORDER_BY = {
  recent: [{ createdAt: "desc" as const }],
  highest: [{ rating: "desc" as const }, { createdAt: "desc" as const }],
  lowest: [{ rating: "asc" as const }, { createdAt: "desc" as const }],
  // Real votes now. Ties break by recency rather than arbitrarily, so
  // the order is stable between page loads.
  helpful: [{ helpfulCount: "desc" as const }, { createdAt: "desc" as const }],
};

export interface ReviewPage {
  reviews: PublicReview[];
  /** Matching the current filter, which is not the same as the total. */
  matched: number;
}

export async function getBusinessReviews(
  businessId: string,
  opts: { sort?: ReviewSort; rating?: number | null; take?: number; skip?: number } = {},
): Promise<ReviewPage> {
  const sort = opts.sort ?? "recent";
  const where = {
    businessId,
    ...visibleWhere,
    ...(opts.rating ? { rating: opts.rating } : {}),
  };

  const [rows, matched] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: ORDER_BY[sort],
      take: opts.take ?? 10,
      skip: opts.skip ?? 0,
      select: {
        id: true,
        rating: true,
        comment: true,
        photos: true,
        helpfulCount: true,
        editedAt: true,
        status: true,
        response: true,
        respondedAt: true,
        createdAt: true,
        booking: {
          select: {
            status: true,
            customerName: true,
            date: true,
            service: { select: { nameAr: true } },
          },
        },
      },
    }),
    db.review.count({ where }),
  ]);

  return {
    matched,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      photos: r.photos,
      helpfulCount: r.helpfulCount,
      editedAt: r.editedAt ? r.editedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      authorName: displayName(r.booking.customerName),
      verifiedBooking: r.booking.status === "COMPLETED",
      serviceName: r.booking.service?.nameAr ?? null,
      bookedOn: r.booking.date ? r.booking.date.toISOString().slice(0, 10) : null,
      response:
        r.response && r.respondedAt
          ? { text: r.response, at: r.respondedAt.toISOString() }
          : null,
    })),
  };
}

/**
 * Writes the denormalised rating back onto the business.
 *
 * The listing sorts and filters on Business.ratingAvg, which is only
 * fast because it is a column. This is the only writer, so the column
 * and the table cannot drift.
 */
export async function recomputeBusinessRating(businessId: string): Promise<void> {
  const summary = await getRatingSummary(businessId);

  await db.business.update({
    where: { id: businessId },
    data: { ratingAvg: summary.average, ratingCount: summary.count },
  });
}

/**
 * Re-exported so existing callers keep working. The rules live in
 * review-policy.ts, where the windows they depend on are written down.
 */
export {
  canReviewBooking,
  canEditReview,
  editDaysLeft,
  EDIT_WINDOW_DAYS,
  REVIEW_WINDOW_DAYS,
} from "./review-policy";
