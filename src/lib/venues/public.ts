import { db } from "@/lib/db";
import type { AccessPolicy } from "./rules";

/**
 * A venue as the public sees it.
 *
 * Only an ACTIVE, published venue exists here. Its directory holds only
 * APPROVED memberships of businesses that are themselves published — a
 * business the venue approved but that is not live, or that left, is
 * not shown. Gate codes, policy authors, managers, request history and
 * anything about customers never leave the server.
 */

export interface DirectoryEntry {
  membershipId: string;
  slug: string;
  nameAr: string;
  nameEn: string | null;
  logoImage: string | null;
  ratingAvg: number;
  ratingCount: number;
  category: { slug: string; nameAr: string; nameEn: string } | null;
  zone: { id: string; nameAr: string; nameEn: string | null; level: number | null } | null;
  unit: string | null;
  branch: { id: string; nameAr: string; nameEn: string | null } | null;
  isVerified: boolean;
}

export interface PublicVenue {
  id: string;
  slug: string;
  kind: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  coverImage: string | null;
  logoImage: string | null;
  updatedAt: string;
  city: { slug: string; nameAr: string; nameEn: string; countryCode: string };
  district: { slug: string; nameAr: string; nameEn: string } | null;
  compound: { slug: string; nameAr: string; nameEn: string | null } | null;
  zones: { id: string; kind: string; nameAr: string; nameEn: string | null; level: number | null }[];
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  gates: { id: string; nameAr: string; nameEn: string | null; kind: string; latitude: number | null; longitude: number | null }[];
  policy: (AccessPolicy & { accessInstructionsAr: string | null; accessInstructionsEn: string | null }) | null;
  exceptions: { kind: string; startsOn: string; endsOn: string; openTime: string | null; closeTime: string | null; noteAr: string | null; noteEn: string | null }[];
  directory: DirectoryEntry[];
}

/** Published-and-approved, as one where-clause shared by every public read. */
export const PUBLIC_VENUE = { status: "ACTIVE" as const, isPublished: true };
/** Listed: approved, the business public, and the branch (if any) still open. */
export const LISTED_MEMBERSHIP = {
  status: "APPROVED" as const,
  business: { isPublished: true },
  OR: [{ branchId: null }, { branch: { isActive: true } }],
};

export async function loadPublicVenue(slug: string, now = new Date()): Promise<PublicVenue | null> {
  const v = await db.venue.findFirst({
    where: { slug, ...PUBLIC_VENUE },
    select: {
      id: true, slug: true, kind: true, nameAr: true, nameEn: true, descriptionAr: true, descriptionEn: true,
      address: true, latitude: true, longitude: true, phone: true, website: true, coverImage: true, logoImage: true,
      updatedAt: true, compoundId: true,
      city: { select: { slug: true, nameAr: true, nameEn: true, countryCode: true } },
      neighborhood: { select: { slug: true, nameAr: true, nameEn: true } },
      compound: { select: { slug: true, nameAr: true, nameEn: true } },
      zones: { orderBy: [{ sortOrder: "asc" }, { level: "asc" }], select: { id: true, kind: true, nameAr: true, nameEn: true, level: true } },
      hours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
      policy: true,
      exceptions: {
        where: { endsOn: { gte: new Date(now.toISOString().slice(0, 10)) } },
        orderBy: { startsOn: "asc" },
        take: 10,
        select: { kind: true, startsOn: true, endsOn: true, openTime: true, closeTime: true, noteAr: true, noteEn: true },
      },
      memberships: {
        where: LISTED_MEMBERSHIP,
        select: {
          id: true,
          unit: true,
          zone: { select: { id: true, nameAr: true, nameEn: true, level: true } },
          branch: { select: { id: true, nameAr: true, nameEn: true, isActive: true } },
          business: {
            select: {
              slug: true, nameAr: true, nameEn: true, logoImage: true, ratingAvg: true, ratingCount: true, isVerified: true,
              category: { select: { slug: true, nameAr: true, nameEn: true } },
            },
          },
        },
      },
    },
  });
  if (!v) return null;

  // Gates: the venue's own, and its compound's; only active ones, and
  // only those the policy allows when it names any. No gate codes.
  const gates = await db.venueGate.findMany({
    where: { isActive: true, OR: [{ venueId: v.id }, ...(v.compoundId ? [{ compoundId: v.compoundId }] : [])] },
    select: { id: true, nameAr: true, nameEn: true, kind: true, latitude: true, longitude: true },
    orderBy: { createdAt: "asc" },
  });
  const allowed = v.policy?.allowedGateIds ?? [];

  return {
    id: v.id,
    slug: v.slug,
    kind: v.kind,
    nameAr: v.nameAr,
    nameEn: v.nameEn,
    descriptionAr: v.descriptionAr,
    descriptionEn: v.descriptionEn,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
    phone: v.phone,
    website: v.website,
    coverImage: v.coverImage,
    logoImage: v.logoImage,
    updatedAt: v.updatedAt.toISOString(),
    city: v.city,
    district: v.neighborhood,
    compound: v.compound,
    zones: v.zones,
    hours: v.hours,
    gates: allowed.length ? gates.filter((g) => allowed.includes(g.id)) : gates,
    policy: v.policy
      ? {
          visitorEligibility: v.policy.visitorEligibility,
          accessBeforeMinutes: v.policy.accessBeforeMinutes,
          accessAfterMinutes: v.policy.accessAfterMinutes,
          maxGuestsPerBooking: v.policy.maxGuestsPerBooking,
          reentryAllowed: v.policy.reentryAllowed,
          accessInstructionsAr: v.policy.accessInstructionsAr,
          accessInstructionsEn: v.policy.accessInstructionsEn,
        }
      : null,
    exceptions: v.exceptions.map((e) => ({
      ...e,
      startsOn: e.startsOn.toISOString().slice(0, 10),
      endsOn: e.endsOn.toISOString().slice(0, 10),
    })),
    directory: v.memberships
      // A branch the business has switched off is not somewhere to go.
      .filter((m) => !m.branch || m.branch.isActive)
      // One entry per business and branch, whatever the history.
      .filter((m, i, all) => all.findIndex((x) => x.business.slug === m.business.slug && x.branch?.id === m.branch?.id) === i)
      .map((m) => ({
        membershipId: m.id,
        slug: m.business.slug,
        nameAr: m.business.nameAr,
        nameEn: m.business.nameEn,
        logoImage: m.business.logoImage,
        ratingAvg: Number(m.business.ratingAvg ?? 0),
        ratingCount: m.business.ratingCount ?? 0,
        isVerified: m.business.isVerified,
        category: m.business.category,
        zone: m.zone,
        unit: m.unit,
        branch: m.branch ? { id: m.branch.id, nameAr: m.branch.nameAr, nameEn: m.branch.nameEn } : null,
      }))
      .sort((a, b) => a.nameAr.localeCompare(b.nameAr, "ar")),
  };
}

/** The directory narrowed by the page's filters. Pure. */
export function filterDirectory(
  entries: DirectoryEntry[],
  f: { category?: string | null; zone?: string | null; q?: string | null },
): DirectoryEntry[] {
  const q = f.q?.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (!f.category || e.category?.slug === f.category) &&
      (!f.zone || e.zone?.id === f.zone) &&
      (!q || e.nameAr.toLowerCase().includes(q) || (e.nameEn ?? "").toLowerCase().includes(q) || (e.category?.nameAr ?? "").includes(q) || (e.category?.nameEn ?? "").toLowerCase().includes(q)),
  );
}

/** The categories present in a directory, with counts, for the filter. */
export function directoryCategories(entries: DirectoryEntry[]) {
  const map = new Map<string, { slug: string; nameAr: string; nameEn: string; count: number }>();
  for (const e of entries) {
    if (!e.category) continue;
    const c = map.get(e.category.slug) ?? { ...e.category, count: 0 };
    c.count++;
    map.set(e.category.slug, c);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** Published venues for the index page and the sitemap. */
export async function listPublicVenues() {
  const rows = await db.venue.findMany({
    where: PUBLIC_VENUE,
    orderBy: { nameAr: "asc" },
    select: {
      slug: true, kind: true, nameAr: true, nameEn: true, coverImage: true, logoImage: true, updatedAt: true,
      city: { select: { slug: true, nameAr: true, nameEn: true } },
      compound: { select: { nameAr: true, nameEn: true } },
      _count: { select: { memberships: { where: LISTED_MEMBERSHIP } } },
    },
  });
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString(), businesses: r._count.memberships }));
}

/** The venues a published business is listed in, for its own page. */
export async function venuesOfBusiness(businessId: string) {
  const rows = await db.venueMembership.findMany({
    where: { businessId, ...LISTED_MEMBERSHIP, venue: PUBLIC_VENUE },
    select: {
      unit: true,
      branchId: true,
      zone: { select: { nameAr: true, nameEn: true } },
      venue: { select: { slug: true, nameAr: true, nameEn: true } },
    },
  });
  // One line per venue, however many branches are in it.
  return rows.filter((r, i) => rows.findIndex((x) => x.venue.slug === r.venue.slug) === i);
}
