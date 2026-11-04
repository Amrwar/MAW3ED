import type { OrganizationKind, Prisma, VenueKind } from "@prisma/client";
import { db } from "@/lib/db";
import { LISTED_ASSOCIATION, PUBLIC_ORG } from "@/lib/organizations/public";
import { LISTED_MEMBERSHIP, PUBLIC_VENUE } from "@/lib/venues/public";
import { searchTerms } from "./synonyms";

/**
 * Malls, groups and venues matching a search, for the block shown above
 * the business results ("Places and groups").
 *
 * Only what the public directory pages would show: a published, approved
 * organization or an active, published venue, and only one that lists at
 * least one published business — a place with an empty directory is a
 * dead end, the same reason its page is noindex. Matched on the folded
 * name (normalize.ts), every word of the query, each word as typed or as
 * one of its stand-ins.
 */

export interface PlaceHit {
  type: "organization" | "venue";
  slug: string;
  nameAr: string;
  nameEn: string | null;
  kind: OrganizationKind | VenueKind;
  logoImage: string | null;
  city: { nameAr: string; nameEn: string } | null;
  /** Businesses its public directory lists. */
  businesses: number;
}

/** At most this many of each, so the block never pushes the results off screen. */
export const PLACES_LIMIT = 3;

function nameMatch(q: string): { AND: { OR: { searchKey: { contains: string } }[] }[] } | null {
  const words = searchTerms(q);
  if (words.length === 0) return null;
  return { AND: words.map((alts) => ({ OR: alts.map((a) => ({ searchKey: { contains: a } })) })) };
}

export async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const match = nameMatch(q);
  if (!match) return [];

  const [orgs, venues] = await Promise.all([
    db.organization.findMany({
      where: { ...PUBLIC_ORG, ...match, associations: { some: LISTED_ASSOCIATION } } satisfies Prisma.OrganizationWhereInput,
      orderBy: [{ nameAr: "asc" }, { id: "asc" }],
      take: PLACES_LIMIT,
      select: {
        slug: true, kind: true, nameAr: true, nameEn: true, logoImage: true,
        city: { select: { nameAr: true, nameEn: true } },
        _count: { select: { associations: { where: LISTED_ASSOCIATION } } },
      },
    }),
    db.venue.findMany({
      where: { ...PUBLIC_VENUE, ...match, memberships: { some: LISTED_MEMBERSHIP } } satisfies Prisma.VenueWhereInput,
      orderBy: [{ nameAr: "asc" }, { id: "asc" }],
      take: PLACES_LIMIT,
      select: {
        slug: true, kind: true, nameAr: true, nameEn: true, logoImage: true,
        city: { select: { nameAr: true, nameEn: true } },
        _count: { select: { memberships: { where: LISTED_MEMBERSHIP } } },
      },
    }),
  ]);

  return [
    ...orgs.map(({ _count, ...o }) => ({ ...o, type: "organization" as const, businesses: _count.associations })),
    ...venues.map(({ _count, ...v }) => ({ ...v, type: "venue" as const, businesses: _count.memberships })),
  ];
}
