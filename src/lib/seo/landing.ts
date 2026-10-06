import { db } from "@/lib/db";

/**
 * Which landing pages exist.
 *
 * One module, used by the pages themselves, by the sitemap and by every
 * internal link — so a page cannot be advertised in the sitemap and
 * then 404, or exist and never be linked to. That disagreement is the
 * state the site is in today: the sitemap offers 41 city and category
 * pages, and 33 of them have no business on them at all.
 *
 * A landing page earns its place by having something on it. Nothing
 * here is generated from the full product of cities and categories —
 * 27 × 14 is 378 pages, of which five would have a business.
 */

/**
 * How many businesses a page needs before it is worth having.
 *
 * One. A page showing a single genuine local business is thin, but it
 * is true, and somebody searching for a dentist in Nasr City is better
 * served by one real dentist than by nothing. The number is here rather
 * than inline so raising it is a one-line decision when there is enough
 * data to be choosier.
 */
export const MIN_BUSINESSES = 1;

export interface LandingCity {
  slug: string;
  nameAr: string;
  nameEn: string | null;
  count: number;
}

export interface LandingCategory {
  slug: string;
  nameAr: string;
  nameEn: string | null;
  icon: string | null;
  count: number;
}

export interface LandingCombo {
  citySlug: string;
  cityNameAr: string;
  cityNameEn: string | null;
  categorySlug: string;
  categoryNameAr: string;
  categoryNameEn: string | null;
  count: number;
}

/** Cities with at least MIN_BUSINESSES published listings, busiest first. */
export async function getLandingCities(): Promise<LandingCity[]> {
  const grouped = await db.business.groupBy({
    by: ["cityId"],
    where: { isPublished: true },
    _count: { _all: true },
  });
  const keep = grouped.filter((g) => g._count._all >= MIN_BUSINESSES);
  if (keep.length === 0) return [];

  const cities = await db.city.findMany({
    where: { id: { in: keep.map((g) => g.cityId) } },
    select: { id: true, slug: true, nameAr: true, nameEn: true },
  });
  const counts = new Map(keep.map((g) => [g.cityId, g._count._all]));

  return cities
    .map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      count: counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar"));
}

/** Categories with at least MIN_BUSINESSES published listings. */
export async function getLandingCategories(): Promise<LandingCategory[]> {
  const grouped = await db.business.groupBy({
    by: ["categoryId"],
    where: { isPublished: true },
    _count: { _all: true },
  });
  const keep = grouped.filter((g) => g._count._all >= MIN_BUSINESSES);
  if (keep.length === 0) return [];

  const cats = await db.category.findMany({
    where: { id: { in: keep.map((g) => g.categoryId) } },
    select: { id: true, slug: true, nameAr: true, nameEn: true, icon: true },
  });
  const counts = new Map(keep.map((g) => [g.categoryId, g._count._all]));

  return cats
    .map((c) => ({
      slug: c.slug,
      nameAr: c.nameAr,
      nameEn: c.nameEn,
      icon: c.icon,
      count: counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar"));
}

/**
 * City-and-category pages that have something on them.
 *
 * Derived from the bookings data rather than enumerated: the pages that
 * exist are exactly the combinations somebody has actually listed a
 * business in.
 */
export async function getLandingCombos(): Promise<LandingCombo[]> {
  const grouped = await db.business.groupBy({
    by: ["cityId", "categoryId"],
    where: { isPublished: true },
    _count: { _all: true },
  });
  const keep = grouped.filter((g) => g._count._all >= MIN_BUSINESSES);
  if (keep.length === 0) return [];

  const [cities, cats] = await Promise.all([
    db.city.findMany({
      where: { id: { in: [...new Set(keep.map((g) => g.cityId))] } },
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
    db.category.findMany({
      where: { id: { in: [...new Set(keep.map((g) => g.categoryId))] } },
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
  ]);
  const cityById = new Map(cities.map((c) => [c.id, c]));
  const catById = new Map(cats.map((c) => [c.id, c]));

  const combos: LandingCombo[] = [];
  for (const g of keep) {
    const city = cityById.get(g.cityId);
    const cat = catById.get(g.categoryId);
    if (!city || !cat) continue;
    combos.push({
      citySlug: city.slug,
      cityNameAr: city.nameAr,
      cityNameEn: city.nameEn,
      categorySlug: cat.slug,
      categoryNameAr: cat.nameAr,
      categoryNameEn: cat.nameEn,
      count: g._count._all,
    });
  }

  return combos.sort((a, b) => b.count - a.count);
}

/**
 * Whether one city-and-category page should exist, and what is on it.
 *
 * Returns null when the pair is unknown or empty, which the route turns
 * into a 404 — not an empty page. A page that renders "no results" is
 * still a page Google can index, and 373 of those is the thin-content
 * problem this whole module exists to avoid.
 */
export async function resolveCombo(
  citySlug: string,
  categorySlug: string,
): Promise<{
  city: { id: string; slug: string; nameAr: string; nameEn: string | null };
  category: { id: string; slug: string; nameAr: string; nameEn: string | null };
  count: number;
} | null> {
  const [city, category] = await Promise.all([
    db.city.findUnique({
      where: { slug: citySlug },
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
    db.category.findUnique({
      where: { slug: categorySlug },
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
  ]);
  if (!city || !category) return null;

  const count = await db.business.count({
    where: { isPublished: true, cityId: city.id, categoryId: category.id },
  });
  if (count < MIN_BUSINESSES) return null;

  return { city, category, count };
}
