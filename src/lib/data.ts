import { db } from "@/lib/db";

export type PublicBusiness = {
  id:          string;
  slug:        string;
  nameAr:      string;
  nameEn:      string | null;
  taglineAr:   string | null;
  coverImage:  string | null;
  logoImage:   string | null;
  isVerified:  boolean;
  category:    { nameAr: string; icon: string; color: string; bgColor: string; slug: string };
  city:        { nameAr: string };
  minPrice:    number | null;
  currency:    string;
  /** Only populated when ordering by mostBooked; otherwise undefined. */
  bookingCount?: number;
};

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

/** Published businesses with optional search/filter */
export async function getPublishedBusinesses(opts?: {
  search?:       string;
  cityId?:       string;
  citySlug?:     string;
  categorySlug?: string;
  /**
   * 0 = Sunday … 6 = Saturday. Narrows to businesses that keep hours
   * that day. Availability is the only time signal in the schema, so
   * this answers "open then", not "has a free slot then".
   */
  dayOfWeek?:    number;
  take?:         number;
  /** Most-booked first. Falls back to newest where bookings tie. */
  orderBy?:      "newest" | "mostBooked";
}): Promise<PublicBusiness[]> {
  const rows = await db.business.findMany({
    where: {
      isPublished: true,
      ...(opts?.search
        ? {
            OR: [
              { nameAr:    { contains: opts.search, mode: "insensitive" } },
              { nameEn:    { contains: opts.search, mode: "insensitive" } },
              { taglineAr: { contains: opts.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(opts?.cityId       ? { cityId:              opts.cityId }              : {}),
      ...(opts?.citySlug     ? { city:     { slug:    opts.citySlug } }          : {}),
      ...(opts?.categorySlug ? { category: { slug:    opts.categorySlug } }      : {}),
      ...(opts?.dayOfWeek !== undefined
        ? { availability: { some: { dayOfWeek: opts.dayOfWeek, isClosed: false } } }
        : {}),
    },
    select: {
      id:         true,
      slug:       true,
      nameAr:     true,
      nameEn:     true,
      taglineAr:  true,
      coverImage: true,
      logoImage:  true,
      isVerified: true,
      category:   { select: { nameAr: true, icon: true, color: true, bgColor: true, slug: true } },
      city:       { select: { nameAr: true } },
      services:   {
        where:   { isAvailable: true },
        orderBy: { price: "asc" },
        take:    1,
        select:  { price: true, currency: true },
      },
      ...(opts?.orderBy === "mostBooked"
        ? { _count: { select: { bookings: true } } }
        : {}),
    },
    orderBy:
      opts?.orderBy === "mostBooked"
        ? [{ bookings: { _count: "desc" } }, { createdAt: "desc" }]
        : { createdAt: "desc" },
    take:    opts?.take ?? 50,
  });

  // services and _count are both unwrapped here rather than spread.
  // Prisma hands back price as a Decimal, and a Decimal cannot cross
  // into a client component — React bails out of hydration and
  // re-renders the whole tree on the client, stranding the server
  // HTML in a hidden div. Everything below this line is a plain
  // string, number or null.
  return rows.map((row) => {
    const { services, ...b } = row as typeof row & {
      _count?: { bookings: number };
    };
    return {
      ...b,
      _count: undefined,
      minPrice: services[0] ? Number(services[0].price) : null,
      currency: services[0]?.currency ?? "EGP",
      bookingCount: row._count?.bookings,
    };
  }) as PublicBusiness[];
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
