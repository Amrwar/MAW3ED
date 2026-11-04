import type { OrgDirectoryEntry, VenueDirectoryEntry } from "@/types/places";
import { ORG_SLUG, SLUG } from "@/lib/links";

/**
 * Directories of organizations and venues: narrowing them, and the way
 * into a business from one. The same rules as the website's pages
 * (src/lib/organizations/public.ts pageDirectory, src/lib/venues/public.ts
 * filterDirectory), applied to the list the API already sent — the app
 * decides nothing about who is listed.
 */

type Entry = OrgDirectoryEntry | VenueDirectoryEntry;

export { ORG_SLUG, SLUG };

export function matches(e: Entry, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    e.nameAr.toLowerCase().includes(s) ||
    (e.nameEn ?? "").toLowerCase().includes(s) ||
    (e.category?.nameAr ?? "").includes(s) ||
    (e.category?.nameEn ?? "").toLowerCase().includes(s) ||
    (e.branch?.nameAr ?? "").includes(s)
  );
}

export function filterEntries<T extends Entry>(
  entries: T[],
  f: { q?: string; category?: string | null; section?: string | null; zone?: string | null },
): T[] {
  return entries.filter(
    (e) =>
      (!f.category || e.category?.slug === f.category) &&
      (!f.section || ("section" in e && e.section === f.section)) &&
      (!f.zone || ("zone" in e && e.zone?.id === f.zone)) &&
      matches(e, f.q ?? ""),
  );
}

/** The categories present, most common first, for the filter chips. */
export function categoriesOf(entries: Entry[]): { slug: string; nameAr: string; nameEn: string; count: number }[] {
  const map = new Map<string, { slug: string; nameAr: string; nameEn: string; count: number }>();
  for (const e of entries) {
    if (!e.category) continue;
    const c = map.get(e.category.slug) ?? { ...e.category, count: 0 };
    c.count++;
    map.set(e.category.slug, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

/** The organization's own headings ("المطاعم", "العيادات"), in the order first used. */
export function sectionsOf(entries: OrgDirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.section).filter((s): s is string => !!s))];
}

/**
 * The business page, reached from an organization's directory: carries the
 * organization so a booking made from there is credited to it, as the
 * website's ?org= does. The server checks the business is really listed
 * there before crediting anything (attributeBooking).
 */
export function businessRoute(businessSlug: string, orgSlug?: string | null): { pathname: "/business/[slug]"; params: { slug: string; org?: string } } {
  const params: { slug: string; org?: string } = { slug: businessSlug };
  if (orgSlug && ORG_SLUG.test(orgSlug)) params.org = orgSlug;
  return { pathname: "/business/[slug]", params };
}

/** An org param from a route or link, or undefined when it is not a slug. */
export function orgParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && ORG_SLUG.test(v) ? v : undefined;
}
