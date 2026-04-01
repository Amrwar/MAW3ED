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
  categorySlug?: string;
  take?:         number;
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
      ...(opts?.categorySlug ? { category: { slug:    opts.categorySlug } }      : {}),
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
    },
    orderBy: { createdAt: "desc" },
    take:    opts?.take ?? 50,
  });

  return rows.map((b) => ({
    ...b,
    minPrice: b.services[0] ? Number(b.services[0].price) : null,
    currency: b.services[0]?.currency ?? "EGP",
  }));
}
