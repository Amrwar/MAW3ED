import { db } from "@/lib/db";
import { cairoDayBefore } from "@/lib/attribution/day";
import { DIRECTORY_PAGE_SIZE } from "./rules";

/**
 * An organization as the public sees it.
 *
 * Only an APPROVED, published organization exists here. Its directory
 * holds only APPROVED associations of businesses whose own page is
 * published, with their branch when the association names one. Sections
 * and ordering are the organization's; everything else about a business
 * comes from the business's own public profile. Nothing about members,
 * pending requests or anybody's customers leaves the server.
 */

export const PUBLIC_ORG = { status: "APPROVED" as const, isPublished: true };
export const LISTED_ASSOCIATION = {
  status: "APPROVED" as const,
  business: { isPublished: true },
  OR: [{ branchId: null }, { branch: { isActive: true } }],
};

export interface OrgDirectoryEntry {
  associationId: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  logoImage: string | null;
  ratingAvg: number;
  ratingCount: number;
  isVerified: boolean;
  relation: string;
  section: string | null;
  sortOrder: number;
  category: { slug: string; nameAr: string; nameEn: string } | null;
  city: { nameAr: string; nameEn: string } | null;
  branch: { id: string; nameAr: string; nameEn: string | null; address: string | null } | null;
}

export async function loadPublicOrganization(slug: string) {
  const org = await db.organization.findFirst({
    where: { slug, ...PUBLIC_ORG },
    select: {
      id: true, slug: true, kind: true, nameAr: true, nameEn: true, descriptionAr: true, descriptionEn: true,
      logoImage: true, coverImage: true, phone: true, email: true, instagram: true, facebook: true,
      address: true, website: true, updatedAt: true,
      city: { select: { slug: true, nameAr: true, nameEn: true } },
      venues: {
        where: { status: "ACTIVE", isPublished: true },
        orderBy: { nameAr: "asc" },
        select: {
          slug: true, kind: true, nameAr: true, nameEn: true, address: true, latitude: true, longitude: true,
          city: { select: { nameAr: true, nameEn: true } },
          hours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
          _count: { select: { memberships: { where: { status: "APPROVED", business: { isPublished: true } } } } },
        },
      },
      associations: {
        where: LISTED_ASSOCIATION,
        select: {
          id: true, relation: true, section: true, sortOrder: true,
          branch: { select: { id: true, nameAr: true, nameEn: true, address: true, isActive: true } },
          business: {
            select: {
              slug: true, nameAr: true, nameEn: true, logoImage: true, ratingAvg: true, ratingCount: true, isVerified: true,
              category: { select: { slug: true, nameAr: true, nameEn: true } },
              city: { select: { nameAr: true, nameEn: true } },
            },
          },
        },
      },
    },
  });
  if (!org) return null;
  const directory: OrgDirectoryEntry[] = org.associations
    .filter((a) => !a.branch || a.branch.isActive)
    .filter((a, i, all) => all.findIndex((x) => x.business.slug === a.business.slug && x.branch?.id === a.branch?.id) === i)
    .map((a) => ({
      associationId: a.id,
      slug: a.business.slug,
      nameAr: a.business.nameAr,
      nameEn: a.business.nameEn,
      logoImage: a.business.logoImage,
      ratingAvg: Number(a.business.ratingAvg ?? 0),
      ratingCount: a.business.ratingCount ?? 0,
      isVerified: a.business.isVerified,
      relation: a.relation,
      section: a.section,
      sortOrder: a.sortOrder,
      category: a.business.category,
      city: a.business.city,
      branch: a.branch ? { id: a.branch.id, nameAr: a.branch.nameAr, nameEn: a.branch.nameEn, address: a.branch.address } : null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.nameAr.localeCompare(b.nameAr, "ar"));
  // The raw associations never leave; the shaped directory does.
  const rest = { ...org, associations: undefined };
  delete rest.associations;
  return { ...rest, updatedAt: org.updatedAt.toISOString(), directory };
}

/** The directory narrowed and paged. Pure, tested without a database. */
export function pageDirectory(
  entries: OrgDirectoryEntry[],
  f: { q?: string | null; category?: string | null; section?: string | null; page?: number; pageSize?: number },
): { entries: OrgDirectoryEntry[]; total: number; page: number; pages: number } {
  const q = f.q?.trim().toLowerCase();
  const matched = entries.filter(
    (e) =>
      (!f.category || e.category?.slug === f.category) &&
      (!f.section || e.section === f.section) &&
      (!q ||
        e.nameAr.toLowerCase().includes(q) ||
        (e.nameEn ?? "").toLowerCase().includes(q) ||
        (e.category?.nameAr ?? "").includes(q) ||
        (e.category?.nameEn ?? "").toLowerCase().includes(q) ||
        (e.branch?.nameAr ?? "").includes(q)),
  );
  const pageSize = f.pageSize ?? DIRECTORY_PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(Math.max(Math.floor(Number.isFinite(f.page) ? (f.page as number) : 1), 1), pages);
  return { entries: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length, page, pages };
}

export function directorySections(entries: OrgDirectoryEntry[]): string[] {
  return [...new Set(entries.map((e) => e.section).filter((s): s is string => !!s))];
}

export function orgDirectoryCategories(entries: OrgDirectoryEntry[]) {
  const map = new Map<string, { slug: string; nameAr: string; nameEn: string; count: number }>();
  for (const e of entries) {
    if (!e.category) continue;
    const c = map.get(e.category.slug) ?? { ...e.category, count: 0 };
    c.count++;
    map.set(e.category.slug, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Published organizations for the index and the sitemap. */
export async function listPublicOrganizations() {
  const rows = await db.organization.findMany({
    where: PUBLIC_ORG,
    orderBy: { nameAr: "asc" },
    select: {
      slug: true, kind: true, nameAr: true, nameEn: true, logoImage: true, coverImage: true, updatedAt: true,
      city: { select: { nameAr: true, nameEn: true } },
      _count: { select: { associations: { where: LISTED_ASSOCIATION } }, },
    },
  });
  return rows.map(({ _count, ...r }) => ({ ...r, updatedAt: r.updatedAt.toISOString(), businesses: _count.associations }));
}

/** The published organizations a business's page should say it belongs to. */
export async function organizationsOfBusiness(businessId: string) {
  const rows = await db.organizationBusiness.findMany({
    where: { businessId, status: "APPROVED", organization: PUBLIC_ORG },
    select: { organization: { select: { slug: true, nameAr: true, nameEn: true } } },
  });
  return rows.filter((r, i) => rows.findIndex((x) => x.organization.slug === r.organization.slug) === i).map((r) => r.organization);
}

/**
 * The attribution written after a booking that started on the
 * organization's page. Never fails the booking, and never for a test
 * booking; only a published organization the business is approved in
 * can be credited, so a request cannot invent an affiliation.
 */
export async function attributeBooking(bookingId: string, orgSlug: string, businessId: string): Promise<void> {
  try {
    const org = await db.organization.findFirst({
      where: { slug: orgSlug, ...PUBLIC_ORG, associations: { some: { businessId, status: "APPROVED" } } },
      select: { id: true },
    });
    if (!org) return;
    await db.organizationBookingAttribution.createMany({ data: [{ bookingId, organizationId: org.id }], skipDuplicates: true });
  } catch {
    // Attribution is a statistic; the booking stands either way.
  }
}

/** Counts for the organization dashboard: visits and attributed bookings only. */
export async function organizationMetrics(organizationId: string, windowDays = 30, now = new Date()) {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  // Views are bucketed on the Cairo day, so the cutoff is the Cairo day
  // windowDays-1 back: the last windowDays days including today — the
  // same span the booking cutoff above covers in time.
  const sinceDay = cairoDayBefore(windowDays - 1, now);
  const [views, attributed, perBusiness] = await Promise.all([
    db.organizationView.groupBy({
      by: ["source"],
      where: { organizationId, day: { gte: sinceDay } },
      _sum: { count: true },
    }),
    // Counted through Booking, like the per-business rows below, so the
    // headline and its breakdown agree when a business (and with it its
    // bookings) is deleted — attribution rows carry no foreign key.
    db.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
      FROM "OrganizationBookingAttribution" a
      JOIN "Booking" bk ON bk.id = a."bookingId"
      WHERE a."organizationId" = ${organizationId} AND a."createdAt" >= ${since}`.then((r) => r[0]?.n ?? 0),
    // One bounded join: names and counts only, never a customer field.
    db.$queryRaw<{ nameAr: string; count: number }[]>`
      SELECT b."nameAr", COUNT(*)::int AS count
      FROM "OrganizationBookingAttribution" a
      JOIN "Booking" bk ON bk.id = a."bookingId"
      JOIN "Business" b ON b.id = bk."businessId"
      WHERE a."organizationId" = ${organizationId} AND a."createdAt" >= ${since}
      GROUP BY b."nameAr"
      ORDER BY count DESC`,
  ]);
  return {
    windowDays,
    views: Object.fromEntries(views.map((v) => [v.source, v._sum.count ?? 0])),
    viewsTotal: views.reduce((n, v) => n + (v._sum.count ?? 0), 0),
    attributedBookings: attributed,
    perBusiness,
  };
}
