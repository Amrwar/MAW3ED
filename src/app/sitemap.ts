import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { localizePath } from "@/lib/locale-path";
import { siteUrl } from "@/lib/url";
import { listPublicVenues } from "@/lib/venues/public";
import {
  getLandingCategories,
  getLandingCities,
  getLandingCombos,

  prerenderHints,} from "@/lib/seo/landing";

/**
 * The sitemap offers exactly the pages that exist.
 *
 * It used to list every city and every category in the database: 41
 * URLs, 33 of which rendered an empty grid under a heading. A sitemap
 * is a claim that these pages are worth fetching, and a third of them
 * being empty is the claim being wrong — it spends crawl budget and
 * teaches a search engine that the site's pages are thin.
 *
 * Everything here comes from lib/seo/landing, which is the same module
 * the pages themselves use to decide whether to render or 404. They
 * cannot disagree.
 *
 * Every page is listed twice, at its Arabic and its English address,
 * each naming both as hreflang alternates (Arabic is x-default), which
 * is how a search engine learns they are one page in two languages.
 *
 * Paginated URLs are deliberately absent. "?page=2" is marked noindex
 * by the pages that emit it, and a sitemap entry for a page we have
 * asked not to be indexed is a contradiction.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Each of the four is allowed to come back empty.
  //
  // The sitemap is prerendered, so an unreachable database used to fail
  // the whole build with "Error occurred prerendering page
  // /sitemap.xml" and a bare ErrorEvent. That is exactly what CI does,
  // building with a placeholder DATABASE_URL, and it went unnoticed for
  // months because the build step never ran.
  //
  // A sitemap listing only the static routes is a worse sitemap; a
  // failed build ships nothing at all. On Vercel, where the database is
  // reachable, this changes nothing.
  const [businesses, cities, categories, combos, venues] = await Promise.all([
    prerenderHints("published businesses", () =>
      db.business.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ),
    prerenderHints("cities", getLandingCities),
    prerenderHints("categories", getLandingCategories),
    prerenderHints("city/category combos", getLandingCombos),
    // Only venues that list somebody: an empty directory is not indexed.
    prerenderHints("published venues", async () => (await listPublicVenues()).filter((v) => v.businesses > 0)),
  ]);

  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl("/"), lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: siteUrl("/businesses"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/categories"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/cities"), lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: siteUrl("/for-business"), lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: siteUrl("/pricing"), lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: siteUrl("/faq"), lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: siteUrl("/contact"), lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: siteUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: siteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: siteUrl("/account-deletion"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = cities.map((c) => ({
    url: siteUrl(`/cities/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: siteUrl(`/categories/${c.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  /**
   * The city-and-category pages, which are the ones worth ranking:
   * "دكتور أسنان في مدينة نصر" is a search somebody actually makes,
   * and this is the page that answers it.
   */
  const comboRoutes: MetadataRoute.Sitemap = combos.map((c) => ({
    url: siteUrl(`/${c.citySlug}/${c.categorySlug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    // Above the broader city and category pages: more specific, and
    // the only page on the site that matches that search exactly.
    priority: 0.75,
  }));

  const venueRoutes: MetadataRoute.Sitemap = venues.length
    ? [
        { url: siteUrl("/venues"), lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 },
        ...venues.map((v) => ({
          url: siteUrl(`/venues/${v.slug}`),
          lastModified: new Date(v.updatedAt),
          changeFrequency: "weekly" as const,
          priority: 0.75,
        })),
      ]
    : [];

  const businessRoutes: MetadataRoute.Sitemap = businesses.map((b) => ({
    url: siteUrl(`/company/${b.slug}`),
    lastModified: b.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return inBothLanguages([
    ...staticRoutes,
    ...comboRoutes,
    ...cityRoutes,
    ...categoryRoutes,
    ...venueRoutes,
    ...businessRoutes,
  ]);
}

/** Each Arabic entry, followed by its English twin; both name both. */
function inBothLanguages(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const base = siteUrl("/").slice(0, -1);
  return entries.flatMap((entry) => {
    const path = entry.url.slice(base.length) || "/";
    const ar = siteUrl(path);
    const en = siteUrl(localizePath(path, "en"));
    const alternates = { languages: { ar, en, "x-default": ar } };
    return [
      { ...entry, url: ar, alternates },
      { ...entry, url: en, alternates },
    ];
  });
}
