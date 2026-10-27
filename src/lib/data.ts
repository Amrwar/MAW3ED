import { db } from "@/lib/db";
import { EMPTY_QUERY } from "@/lib/discovery/params";
import { searchBusinesses, type DiscoveryBusiness } from "@/lib/discovery/search";

/** The listing shape. Kept as an alias so existing imports still read.*/
export type PublicBusiness = DiscoveryBusiness;

/** All categories ordered by Arabic name */
export async function getCategories() {
  return db.category.findMany({ orderBy: { nameAr: "asc" } });
}

/** All cities ordered by Arabic name */
export async function getCities() {
  return db.city.findMany({ orderBy: { nameAr: "asc" } });
}

/** Single category by slug */
export async function getCategoryBySlug(slug: string) {
  return db.category.findUnique({ where: { slug } });
}

/** Single city by slug */
export async function getCityBySlug(slug: string) {
  return db.city.findUnique({ where: { slug } });
}

/**
 * Published businesses for the simple listings — a category page, a
 * city page, a row on the homepage.
 *
 * Delegates to the discovery search so there is one definition of what
 * a published business looks like, one place that decides a price of
 * zero means "not set", and one card that can render the result.
 */
export async function getPublishedBusinesses(opts?: {
  citySlug?: string;
  categorySlug?: string;
  take?: number;
  orderBy?: "newest" | "mostBooked";
}): Promise<DiscoveryBusiness[]> {
  const result = await searchBusinesses({
    ...EMPTY_QUERY,
    city: opts?.citySlug ?? "",
    category: opts?.categorySlug ?? "",
    sort: opts?.orderBy === "mostBooked" ? "most-booked" : "recommended",
  });

  return opts?.take ? result.businesses.slice(0, opts.take) : result.businesses;
}

/* ─── Platform figures ───────────────────────────────────────
   Every number the homepage shows is counted here. Nothing on the
   page is allowed to state a figure that did not come out of the
   database — the old build advertised 300+ businesses and 12,000
   bookings against five listings and four bookings. */

export type CategoryWithCount = {
  id:      string;
  slug:    string;
  nameAr:  string;
  nameEn:  string;
  icon:    string;
  color:   string;
  bgColor: string;
  /** Published businesses in this category. Often zero; that is fine. */
  count:   number;
};

/**
 * Categories with their real published-business counts, the busiest
 * first. An empty category still appears — the catalogue is what the
 * platform offers, not a claim about how full it is.
 */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const [categories, grouped] = await Promise.all([
    db.category.findMany({ orderBy: { nameAr: "asc" } }),
    db.business.groupBy({
      by:    ["categoryId"],
      where: { isPublished: true },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map(grouped.map((g) => [g.categoryId, g._count._all]));

  return categories
    .map((c) => ({
      id:      c.id,
      slug:    c.slug,
      nameAr:  c.nameAr,
      nameEn:  c.nameEn,
      icon:    c.icon,
      color:   c.color,
      bgColor: c.bgColor,
      count:   counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar"));
}

/**
 * How many listings there must be before the site states a count.
 * "4 businesses in 3 cities" tells a visitor the shelves are empty;
 * below this the pages say what Maw3ed does instead of how big it is.
 */
export const SHOW_COUNTS_FROM = 50;

export type PlatformReach = {
  /** Published listings. */
  businesses: number;
  /** Cities that actually have a listing, not the size of the catalogue. */
  cities:     number;
  /** Categories that actually have a listing. */
  categories: number;
};

/** The three figures the homepage is allowed to state. */
export async function getPlatformReach(): Promise<PlatformReach> {
  const [businesses, byCity, byCategory] = await Promise.all([
    db.business.count({ where: { isPublished: true } }),
    db.business.groupBy({ by: ["cityId"],     where: { isPublished: true } }),
    db.business.groupBy({ by: ["categoryId"], where: { isPublished: true } }),
  ]);

  return { businesses, cities: byCity.length, categories: byCategory.length };
}

/** Cities that have at least one published listing, busiest first. */
export async function getCitiesWithListings() {
  const grouped = await db.business.groupBy({
    by:     ["cityId"],
    where:  { isPublished: true },
    _count: { _all: true },
  });
  if (grouped.length === 0) return [];

  const cities = await db.city.findMany({
    where: { id: { in: grouped.map((g) => g.cityId) } },
  });
  const counts = new Map(grouped.map((g) => [g.cityId, g._count._all]));

  return cities
    .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.nameAr.localeCompare(b.nameAr, "ar"));
}
