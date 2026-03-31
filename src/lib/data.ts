import { db } from "@/lib/db";

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
