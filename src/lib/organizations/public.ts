import { db } from "@/lib/db";
import { cairoDayBefore } from "@/lib/attribution/day";
import type { FunnelStep, OrganizationKind } from "@prisma/client";
import { venueMetrics } from "@/lib/venues/metrics";
import { DIRECTORY_PAGE_SIZE } from "./rules";
import { searchTerms } from "@/lib/discovery/synonyms";

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
/**
 * Listed publicly: businesses an organization owns or hosts. Who manages
 * a business's back office (MANAGED) is not something its customers need
 * to see on a directory page. Suspended relationships are not listed.
 */
export const LISTED_RELATIONS = ["OWNED", "HOSTED", "TENANT", "PARTNER", "FRANCHISE"] as const;
export const LISTED_ASSOCIATION = {
  status: "APPROVED" as const,
  relation: { in: [...LISTED_RELATIONS] },
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
      // One level each way, never traversed further: the page shows where
      // this organization belongs and what belongs directly to it.
      parent: { where: PUBLIC_ORG, select: { slug: true, nameAr: true, nameEn: true, kind: true } },
      children: { where: PUBLIC_ORG, orderBy: { nameAr: "asc" }, take: 50, select: { slug: true, nameAr: true, nameEn: true, kind: true } },
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

/** The two families the /groups index can be narrowed to. */
export const ORG_FAMILIES = {
  destinations: ["MALL", "COMPOUND", "COMMERCIAL_BUILDING"],
  groups: ["BUSINESS_GROUP", "RESTAURANT_GROUP", "CLINIC_GROUP", "FRANCHISE"],
} as const satisfies Record<string, readonly OrganizationKind[]>;
export type OrgFamily = keyof typeof ORG_FAMILIES;

/**
 * Published organizations for the index and the sitemap. `q` matches the
 * folded name word by word (lib/discovery/normalize.ts); `family` narrows
 * to malls and destinations or to business groups.
 */
export async function listPublicOrganizations(filter: { q?: string; family?: OrgFamily } = {}) {
  const words = filter.q ? searchTerms(filter.q) : [];
  const rows = await db.organization.findMany({
    where: {
      ...PUBLIC_ORG,
      ...(words.length ? { AND: words.map((alts) => ({ OR: alts.map((a) => ({ searchKey: { contains: a } })) })) } : {}),
      ...(filter.family ? { kind: { in: [...ORG_FAMILIES[filter.family]] } } : {}),
    },
    orderBy: [{ nameAr: "asc" }, { id: "asc" }],
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
    where: { businessId, status: "APPROVED", relation: { in: [...LISTED_RELATIONS] }, organization: PUBLIC_ORG },
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
      where: { slug: orgSlug, ...PUBLIC_ORG, associations: { some: { businessId, status: "APPROVED", relation: { in: [...LISTED_RELATIONS] } } } },
      select: { id: true },
    });
    if (!org) return;
    await db.organizationBookingAttribution.createMany({ data: [{ bookingId, organizationId: org.id }], skipDuplicates: true });
  } catch {
    // Attribution is a statistic; the booking stands either way.
  }
}

/**
 * Counts for the organization dashboard (Phase 26). Only what the
 * organization's own directory produced, and only as counts:
 *
 *   - visits to its page, by channel (OrganizationView);
 *   - business pages opened from its directory, and the steps after,
 *     credited to it only when the business is listed in it (FunnelCount);
 *   - bookings its directory sent (OrganizationBookingAttribution): real
 *     bookings only — never a test booking or an abandoned checkout —
 *     per business, for the businesses it lists now;
 *   - conversion: those bookings over its page visits;
 *   - which categories its visitors opened, by business category;
 *   - booking activity at the venues it runs, by the venue rules
 *     (lib/venues/metrics.ts: approved tenants, since they joined).
 *
 * Never a customer, a price, a payment or a booking's contents — whether
 * the organization owns, manages or merely hosts the business
 * (docs/architecture/ORGANIZATION_PERMISSIONS.md).
 */
export async function organizationMetrics(organizationId: string, windowDays = 30, now = new Date()) {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  // Views are bucketed on the Cairo day, so the cutoff is the Cairo day
  // windowDays-1 back: the last windowDays days including today — the
  // same span the booking cutoff covers in time.
  const sinceDay = cairoDayBefore(windowDays - 1, now);
  const [views, attributed, perBusiness, referred, categories, venues] = await Promise.all([
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
      WHERE a."organizationId" = ${organizationId} AND a."createdAt" >= ${since}
        AND bk."isTest" = false AND bk.status NOT IN ('PENDING_PAYMENT', 'FAILED_PAYMENT')`.then((r) => r[0]?.n ?? 0),
    // One bounded join: names and counts only, never a customer field.
    // Businesses it no longer lists keep counting in the headline (the
    // directory did send those bookings) but are not named.
    db.$queryRaw<{ nameAr: string; nameEn: string | null; count: number }[]>`
      SELECT b."nameAr", b."nameEn", COUNT(*)::int AS count
      FROM "OrganizationBookingAttribution" a
      JOIN "Booking" bk ON bk.id = a."bookingId"
      JOIN "Business" b ON b.id = bk."businessId"
      WHERE a."organizationId" = ${organizationId} AND a."createdAt" >= ${since}
        AND bk."isTest" = false AND bk.status NOT IN ('PENDING_PAYMENT', 'FAILED_PAYMENT')
        AND EXISTS (SELECT 1 FROM "OrganizationBusiness" ob
                    WHERE ob."organizationId" = a."organizationId" AND ob."businessId" = b.id AND ob.status = 'APPROVED')
      GROUP BY b.id, b."nameAr", b."nameEn"
      ORDER BY count DESC, b."nameAr" ASC
      LIMIT 50`,
    db.funnelCount.groupBy({
      by: ["step"],
      where: { organizationId, day: { gte: sinceDay } },
      _sum: { count: true },
    }),
    db.$queryRaw<{ nameAr: string; nameEn: string; views: number }[]>`
      SELECT c."nameAr", c."nameEn", SUM(f.count)::int AS views
      FROM "FunnelCount" f
      JOIN "Business" b ON b.id = f."businessId"
      JOIN "Category" c ON c.id = b."categoryId"
      WHERE f."organizationId" = ${organizationId} AND f.step = 'BUSINESS_VIEW' AND f.day >= ${sinceDay}::date
      GROUP BY c.id, c."nameAr", c."nameEn"
      ORDER BY views DESC, c."nameAr" ASC
      LIMIT 20`,
    db.venue.findMany({
      where: { organizationId },
      orderBy: [{ nameAr: "asc" }, { id: "asc" }],
      take: 10,
      select: { id: true, slug: true, nameAr: true, nameEn: true },
    }),
  ]);
  const venueActivity = await Promise.all(
    venues.map(async (v) => {
      const m = await venueMetrics(v.id, windowDays, now);
      return { slug: v.slug, nameAr: v.nameAr, nameEn: v.nameEn, tenants: m.tenants.approved, bookings: m.bookings.total };
    }),
  );
  const viewsTotal = views.reduce((n, v) => n + (v._sum.count ?? 0), 0);
  const steps = Object.fromEntries(referred.map((r) => [r.step, r._sum.count ?? 0])) as Partial<Record<FunnelStep, number>>;
  return {
    windowDays,
    views: Object.fromEntries(views.map((v) => [v.source, v._sum.count ?? 0])),
    viewsTotal,
    attributedBookings: attributed,
    /** Bookings sent over page visits; null with no visits. Can exceed 1 (app bookings carry the organization too). */
    conversion: viewsTotal > 0 ? attributed / viewsTotal : null,
    perBusiness,
    /** Tabs that went from the directory to a business page, and on. */
    referred: {
      businessViews: steps.BUSINESS_VIEW ?? 0,
      serviceSelected: steps.SERVICE_SELECTED ?? 0,
      bookingStarted: steps.BOOKING_STARTED ?? 0,
      timeSelected: steps.TIME_SELECTED ?? 0,
    },
    categories,
    venues: venueActivity,
  };
}
