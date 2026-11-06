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

interface Countable {
  id: string;
  slug: string;
  count: number;
  /** Set on a subcategory in a flat list; absent where counts are rolled up. */
  parentId?: string | null;
}

/**
 * The empty categories, most wanted first. In a flat list (parents and
 * subcategories side by side, each with its own count), a parent whose
 * businesses are all filed under a subcategory is not "coming", and
 * neither is an empty subcategory of a parent that has businesses:
 * browsing the parent already covers it.
 */
export function upcomingCategories<T extends Countable>(all: T[], limit = Infinity): T[] {
  const live = new Set(all.filter((c) => c.count > 0).map((c) => c.id));
  const liveParents = new Set(all.filter((c) => c.count > 0 && c.parentId).map((c) => c.parentId as string));
  return all
    .filter((c) => c.count === 0 && !liveParents.has(c.id) && !(c.parentId && live.has(c.parentId)))
    .sort((a, b) => rank(a.slug) - rank(b.slug))
    .slice(0, Math.max(0, limit));
}
