/**
 * Organizations (malls, restaurant and clinic groups, buildings) and
 * venues, as the public API sends them (src/lib/organizations/public.ts,
 * src/lib/venues/public.ts). Public data only: names, places and the
 * businesses each lists — never a member, a request or a customer.
 */

type Named = { nameAr: string; nameEn: string | null };
type Category = { slug: string; nameAr: string; nameEn: string };

export interface OrgSummary extends Named {
  slug: string;
  kind: string;
  logoImage: string | null;
  coverImage: string | null;
  city: { nameAr: string; nameEn: string } | null;
  businesses: number;
}

export interface OrgDirectoryEntry extends Named {
  associationId: string;
  slug: string;
  logoImage: string | null;
  ratingAvg: number;
  ratingCount: number;
  isVerified: boolean;
  relation: string;
  section: string | null;
  sortOrder: number;
  category: Category | null;
  city: { nameAr: string; nameEn: string } | null;
  branch: { id: string; nameAr: string; nameEn: string | null; address: string | null } | null;
}

export interface OrgDetail extends Named {
  id: string;
  slug: string;
  kind: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  logoImage: string | null;
  coverImage: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  website: string | null;
  city: { slug: string; nameAr: string; nameEn: string } | null;
  parent: (Named & { slug: string; kind: string }) | null;
  children: (Named & { slug: string; kind: string })[];
  venues: (Named & { slug: string; kind: string; address: string | null; _count?: { memberships: number } })[];
  directory: OrgDirectoryEntry[];
}

export interface VenueSummary extends Named {
  slug: string;
  kind: string;
  coverImage: string | null;
  logoImage: string | null;
  city: { slug: string; nameAr: string; nameEn: string } | null;
  businesses: number;
}

export interface VenueDirectoryEntry extends Named {
  membershipId: string;
  slug: string;
  logoImage: string | null;
  ratingAvg: number;
  ratingCount: number;
  isVerified: boolean;
  category: Category | null;
  zone: { id: string; nameAr: string; nameEn: string | null; level: number | null } | null;
  unit: string | null;
  branch: { id: string; nameAr: string; nameEn: string | null } | null;
}

export interface VenueDetail extends Named {
  id: string;
  slug: string;
  kind: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  coverImage: string | null;
  logoImage: string | null;
  city: { slug: string; nameAr: string; nameEn: string } | null;
  organization: (Named & { slug: string }) | null;
  zones: { id: string; kind: string; nameAr: string; nameEn: string | null; level: number | null }[];
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  directory: VenueDirectoryEntry[];
}
