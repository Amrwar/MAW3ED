/**
 * How a list of reviews can be ordered, and how to read that choice
 * from a URL.
 *
 * Split out of reviews.ts for the same reason resource-labels.ts is
 * split out of capabilities.ts: reviews.ts imports `db`, and the
 * reviews section is a client component. One value imported across
 * that line — this list, to render the sort buttons — pulled
 * PrismaClient into the browser bundle, and with it the generated
 * metadata for every model and column in the database: 213 KB raw,
 * 68 KB over the wire, on a page where a visitor is reading a
 * barbershop's opening hours.
 *
 * Shipping the schema is the worse half. Nothing here is a credential,
 * but the names of every table and field are a map of the database
 * handed to anyone who opens devtools, and they are the kind of detail
 * that makes a later mistake easier to exploit.
 *
 * So this file imports nothing. A client component that needs the sort
 * options takes them from here; the types it needs stay in reviews.ts
 * and are imported with `import type`, which TypeScript erases.
 */

/** The orderings the reviews list offers, in the order they appear. */
export const REVIEW_SORTS = ["recent", "highest", "lowest", "helpful"] as const;

export type ReviewSort = (typeof REVIEW_SORTS)[number];

/** Anything unrecognised falls back to the default rather than throwing. */
export function parseReviewSort(raw: string | undefined): ReviewSort {
  return REVIEW_SORTS.includes(raw as ReviewSort) ? (raw as ReviewSort) : "recent";
}

/** A star filter is one of the five buckets, or none. */
export function parseRatingFilter(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}
