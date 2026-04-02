import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const BASE_URL = (process.env.AUTH_URL ?? "https://maw3ed.net").replace(/\/$/, "");

function url(path: string): string {
  return `${BASE_URL}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [businesses, cities, categories] = await Promise.all([
    db.business.findMany({
      where:   { isPublished: true },
      select:  { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    db.city.findMany({
      select:  { slug: true },
      orderBy: { nameAr: "asc" },
    }),
    db.category.findMany({
      select:  { slug: true },
      orderBy: { nameAr: "asc" },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url:             url("/"),
      lastModified:    new Date(),
      changeFrequency: "daily",
      priority:        1.0,
    },
    {
      url:             url("/businesses"),
      lastModified:    new Date(),
      changeFrequency: "daily",
      priority:        0.9,
    },
  ];

  const cityRoutes: MetadataRoute.Sitemap = cities.map((c) => ({
    url:             url(`/cities/${c.slug}`),
    lastModified:    new Date(),
    changeFrequency: "weekly" as const,
    priority:        0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url:             url(`/categories/${c.slug}`),
    lastModified:    new Date(),
    changeFrequency: "weekly" as const,
    priority:        0.7,
  }));

  const businessRoutes: MetadataRoute.Sitemap = businesses.map((b) => ({
    url:             url(`/company/${b.slug}`),
    lastModified:    b.updatedAt,
    changeFrequency: "weekly" as const,
    priority:        0.8,
  }));

  return [...staticRoutes, ...cityRoutes, ...categoryRoutes, ...businessRoutes];
}
