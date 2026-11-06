/**
 * Categories with no business yet, shown as "coming soon" tiles: on the
 * home page (a few, to fill two rows) and on /categories (all of them).
 * One ordering for both, so the two pages never disagree on what is
 * coming.
 */

/** Which empty categories to show first: what people search for most. */
const UPCOMING_FIRST = ["dentists", "gyms", "beauty-centers", "clinics", "salons", "spas", "education", "labs"];

function rank(slug: string): number {
  const i = UPCOMING_FIRST.indexOf(slug);
  return i === -1 ? UPCOMING_FIRST.length : i;
}

/**
 * The empty categories, most wanted first, leaving out any slug in
 * `live` (a parent counted through its children is not "coming").
 */
export function upcomingCategories<T extends { slug: string; count: number }>(
  all: T[],
  live: Iterable<string> = [],
  limit = Infinity,
): T[] {
  const skip = new Set(live);
  return all
    .filter((c) => c.count === 0 && !skip.has(c.slug))
    .sort((a, b) => rank(a.slug) - rank(b.slug))
    .slice(0, Math.max(0, limit));
}
