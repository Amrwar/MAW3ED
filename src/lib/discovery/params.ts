/**
 * The discovery URL contract.
 *
 * Every filter, sort and page lives in the query string, so a refresh
 * keeps the state, back and forward work, and a link is shareable. This
 * module is the single reading of that contract — parsing in, building
 * out — and it is pure so it can be tested without a database.
 *
 * Unknown or malformed values fall back to the default rather than
 * throwing: a hand-edited URL should show a sensible page, not a 500.
 */

export const SORTS = [
  "recommended",
  "rating",
  "most-booked",
  "price-asc",
  "price-desc",
  "soonest",
] as const;
export type Sort = (typeof SORTS)[number];

export const AVAILABILITY = ["any", "today", "tomorrow", "open-now"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/** Ratings worth offering as a floor. 5 is excluded — it filters to noise. */
export const RATING_FLOORS = [3, 3.5, 4, 4.5] as const;

export const PAGE_SIZE = 12;
/** A hard ceiling, so `?page=99999` cannot ask the database for an absurd offset. */
export const MAX_PAGE = 500;

export interface DiscoveryQuery {
  /** Free text, matched against business, service and staff names. */
  q: string;
  /** Category slug. May be a top-level category or a subcategory. */
  category: string;
  /** Subcategory slug, only meaningful alongside a parent category. */
  subcategory: string;
  /** City slug — slugs, not ids, so the URL reads and ranks. */
  city: string;
  neighborhood: string;
  /** Inclusive bounds in EGP on the cheapest service. */
  minPrice: number | null;
  maxPrice: number | null;
  /** Minimum average rating. */
  rating: number | null;
  availability: Availability;
  verified: boolean;
  instant: boolean;
  online: boolean;
  sort: Sort;
  page: number;
}

export const EMPTY_QUERY: DiscoveryQuery = {
  q: "",
  category: "",
  subcategory: "",
  city: "",
  neighborhood: "",
  minPrice: null,
  maxPrice: null,
  rating: null,
  availability: "any",
  verified: false,
  instant: false,
  online: false,
  sort: "recommended",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined>;

function one(raw: RawParams, key: string): string {
  const v = raw[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function bool(raw: RawParams, key: string): boolean {
  return one(raw, key) === "1";
}

/** A slug we are willing to put in a WHERE clause. */
function slug(raw: RawParams, key: string): string {
  const v = one(raw, key).toLowerCase();
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(v) ? v : "";
}

function money(raw: RawParams, key: string): number | null {
  const v = one(raw, key);
  if (!v) return null;
  const n = Number(v);
  // Prices are whole pounds here; a negative or absurd bound is a typo.
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return Math.round(n);
}

export function parseDiscoveryQuery(raw: RawParams): DiscoveryQuery {
  const sortRaw = one(raw, "sort") as Sort;
  const availRaw = one(raw, "available") as Availability;

  const ratingRaw = Number(one(raw, "rating"));
  const rating = RATING_FLOORS.includes(ratingRaw as (typeof RATING_FLOORS)[number])
    ? ratingRaw
    : null;

  let minPrice = money(raw, "minPrice");
  let maxPrice = money(raw, "maxPrice");
  // A reversed range is a slider dragged past itself, not an empty result.
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const pageRaw = Number(one(raw, "page"));
  const page =
    Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, MAX_PAGE) : 1;

  return {
    q: one(raw, "q").slice(0, 100),
    category: slug(raw, "category"),
    subcategory: slug(raw, "subcategory"),
    city: slug(raw, "city"),
    neighborhood: slug(raw, "neighborhood"),
    minPrice,
    maxPrice,
    rating,
    availability: AVAILABILITY.includes(availRaw) ? availRaw : "any",
    verified: bool(raw, "verified"),
    instant: bool(raw, "instant"),
    online: bool(raw, "online"),
    sort: SORTS.includes(sortRaw) ? sortRaw : "recommended",
    page,
  };
}

/**
 * Serialises back to a query string, leaving defaults out so a plain
 * listing stays at /businesses rather than carrying a dozen `=` pairs.
 */
export function buildDiscoveryParams(q: Partial<DiscoveryQuery>): URLSearchParams {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
  };

  put("q", q.q);
  put("category", q.category);
  put("subcategory", q.subcategory);
  put("city", q.city);
  put("neighborhood", q.neighborhood);
  put("minPrice", q.minPrice);
  put("maxPrice", q.maxPrice);
  put("rating", q.rating);
  if (q.availability && q.availability !== "any") p.set("available", q.availability);
  if (q.verified) p.set("verified", "1");
  if (q.instant) p.set("instant", "1");
  if (q.online) p.set("online", "1");
  if (q.sort && q.sort !== "recommended") p.set("sort", q.sort);
  if (q.page && q.page > 1) p.set("page", String(q.page));

  return p;
}

/** The canonical href for a query. Used for links, pagination and rel=canonical. */
export function discoveryHref(q: Partial<DiscoveryQuery>, base = "/businesses"): string {
  const p = buildDiscoveryParams(q);
  return p.size ? `${base}?${p}` : base;
}

/** True when anything narrows the listing — drives the "clear all" affordance. */
export function hasActiveFilters(q: DiscoveryQuery): boolean {
  return Boolean(
    q.q ||
      q.category ||
      q.subcategory ||
      q.city ||
      q.neighborhood ||
      q.minPrice !== null ||
      q.maxPrice !== null ||
      q.rating !== null ||
      q.availability !== "any" ||
      q.verified ||
      q.instant ||
      q.online,
  );
}

/**
 * Page numbers to render, with gaps collapsed to an ellipsis.
 *
 * Always shows the first and last page so the ends of the range stay
 * reachable in one tap.
 */
export function pageWindow(current: number, total: number, span = 1): (number | "gap")[] {
  if (total <= 1) return total === 1 ? [1] : [];

  const pages = new Set<number>([1, total]);
  for (let i = current - span; i <= current + span; i++) {
    if (i >= 1 && i <= total) pages.add(i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}
