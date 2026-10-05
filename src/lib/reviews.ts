import { db } from "@/lib/db";

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

export const REVIEW_SORTS = ["recent", "highest", "lowest", "helpful"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export function parseReviewSort(raw: string | undefined): ReviewSort {
  return REVIEW_SORTS.includes(raw as ReviewSort) ? (raw as ReviewSort) : "recent";
}

/** A star filter is one of the five buckets, or none. */
export function parseRatingFilter(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

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
    where: { businessId },
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
  // Nothing votes on reviews yet, so "most helpful" would be a made-up
  // ordering. It means "the ones with something written in them".
  helpful: [{ createdAt: "desc" as const }],
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
    ...(opts.rating ? { rating: opts.rating } : {}),
    ...(sort === "helpful" ? { comment: { not: null } } : {}),
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
        response: true,
        respondedAt: true,
        createdAt: true,
        booking: {
          select: {
            status: true,
            customerName: true,
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
      createdAt: r.createdAt.toISOString(),
      authorName: displayName(r.booking.customerName),
      verifiedBooking: r.booking.status === "COMPLETED",
      serviceName: r.booking.service?.nameAr ?? null,
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
 * Whether this booking may be reviewed.
 *
 * Only a completed appointment, and only once — the unique constraint
 * on Review.bookingId enforces the second half, this reports it before
 * the customer types anything.
 */
export function canReviewBooking(b: {
  status: string;
  review?: { id: string } | null;
}): { allowed: boolean; reason: "ok" | "not-completed" | "already-reviewed" } {
  if (b.review) return { allowed: false, reason: "already-reviewed" };
  if (b.status !== "COMPLETED") return { allowed: false, reason: "not-completed" };
  return { allowed: true, reason: "ok" };
}
