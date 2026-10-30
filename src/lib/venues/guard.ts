import { db } from "@/lib/db";
import { currentCaller, err } from "@/lib/api";
import { can } from "@/lib/admin/permissions";
import { authorityOver, venueCan, type RoleGrant, type VenueAction, type VenueAuthority } from "./access";

/**
 * The server-side gate for every venue route and page.
 *
 * Roles are read from the database on each request — never from the
 * session token, which is a snapshot that outlives a revoked role. A
 * caller without authority over the venue, or without the action, gets
 * 404: whether a venue exists in draft, and who runs it, is nobody
 * else's business.
 */

export interface VenueCaller {
  userId: string;
  name: string | null;
  platform: boolean;
  roles: RoleGrant[];
}

export async function loadVenueCaller(): Promise<VenueCaller | null> {
  const session = await currentCaller().catch(() => null);
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      adminRole: true,
      venueRoles: { select: { kind: true, organizationId: true, compoundId: true, venueId: true } },
    },
  });
  if (!user) return null;
  return {
    userId: user.id,
    name: user.name,
    platform: can(user.adminRole, "venues.manage"),
    roles: user.venueRoles,
  };
}

const notFound = () => err("غير موجود", 404);

/**
 * The caller, the venue, and the caller's authority over it — or a 404
 * Response thrown for the route's catch to return.
 */
export async function requireVenueAccess(
  venueId: string,
  action: VenueAction,
): Promise<{ caller: VenueCaller; venue: { id: string; organizationId: string | null; compoundId: string | null; status: string; isPublished: boolean }; authority: VenueAuthority }> {
  const caller = await loadVenueCaller();
  if (!caller) throw err("سجّل دخولك الأول", 401);
  const venue = await db.venue.findUnique({
    where: { id: venueId },
    select: { id: true, organizationId: true, compoundId: true, status: true, isPublished: true },
  });
  if (!venue) throw notFound();
  const authority = authorityOver(caller, venue);
  if (!venueCan(authority, action)) throw notFound();
  return { caller, venue, authority: authority! };
}

/** The venues this caller may open in the venue console, widest scope first. */
export async function venuesFor(caller: VenueCaller) {
  const select = {
    id: true,
    slug: true,
    nameAr: true,
    nameEn: true,
    status: true,
    isPublished: true,
    organizationId: true,
    compoundId: true,
  } as const;
  if (caller.platform) return db.venue.findMany({ select, orderBy: { createdAt: "desc" } });
  const orgIds = caller.roles.filter((r) => r.kind === "ORGANIZATION_ADMIN" && r.organizationId).map((r) => r.organizationId!);
  const compoundIds = caller.roles.filter((r) => r.kind === "COMPOUND_ADMIN" && r.compoundId).map((r) => r.compoundId!);
  const venueIds = caller.roles.filter((r) => r.kind === "VENUE_MANAGER" && r.venueId).map((r) => r.venueId!);
  if (!orgIds.length && !compoundIds.length && !venueIds.length) return [];
  return db.venue.findMany({
    where: {
      OR: [
        ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : []),
        ...(compoundIds.length ? [{ compoundId: { in: compoundIds } }] : []),
        ...(venueIds.length ? [{ id: { in: venueIds } }] : []),
      ],
    },
    select,
    orderBy: { createdAt: "desc" },
  });
}
