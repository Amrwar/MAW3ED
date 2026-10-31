import type { VenueRoleKind } from "@prisma/client";

/**
 * Who may do what at a venue.
 *
 * Authority over a venue comes from exactly one of:
 *
 *   PLATFORM            a Maw3ed administrator with "venues.manage"
 *   ORGANIZATION_OWNER  the account the organization belongs to
 *   ORGANIZATION_ADMIN  every compound and venue of one operator
 *   COMPOUND_ADMIN      every venue in one compound, and its gates
 *   VENUE_MANAGER       one venue
 *
 * and from nothing else. Owning a business inside a venue gives no
 * authority over the venue; managing a venue gives none over the
 * businesses in it beyond deciding whether they are listed. No action
 * here reads a customer, a booking's contents or a payment — venue
 * metrics are counts (lib/venues/metrics.ts).
 *
 * Two things only the platform does: putting a venue in front of the
 * public (status, publishing) and granting venue roles. An operator's
 * staff cannot make themselves public or appoint each other.
 *
 * Pure: the caller loads the roles and the venue's place in the
 * hierarchy, so the whole matrix is tested without a database.
 */

export type VenueAuthority = "PLATFORM" | VenueRoleKind;

export const VENUE_ACTIONS = [
  "venue.view",
  "venue.editInfo",
  "venue.hours",
  "venue.zones",
  "venue.gates",
  "venue.policy",
  "venue.exceptions",
  "venue.memberships.decide",
  "venue.metrics",
  // Platform only.
  "venue.publish",
  "venue.roles.grant",
] as const;

export type VenueAction = (typeof VENUE_ACTIONS)[number];

const OPERATOR: VenueAction[] = [
  "venue.view",
  "venue.editInfo",
  "venue.hours",
  "venue.zones",
  "venue.gates",
  "venue.policy",
  "venue.exceptions",
  "venue.memberships.decide",
  "venue.metrics",
];

export const VENUE_PERMISSIONS: Record<VenueAuthority, readonly VenueAction[]> = {
  PLATFORM: VENUE_ACTIONS,
  // Over VENUES the owner and the manager can do the same things;
  // what only the owner may do (publish the organization's page,
  // manage its members) lives in lib/organizations/access.ts.
  ORGANIZATION_OWNER: OPERATOR,
  ORGANIZATION_ADMIN: OPERATOR,
  COMPOUND_ADMIN: OPERATOR,
  VENUE_MANAGER: OPERATOR,
};

/** A venue role row, as loaded for the caller. */
export interface RoleGrant {
  kind: VenueRoleKind;
  organizationId: string | null;
  compoundId: string | null;
  venueId: string | null;
}

/** Where a venue sits: what a role has to match to reach it. */
export interface VenueScope {
  id: string;
  organizationId: string | null;
  compoundId: string | null;
}

/** Widest first, so the strongest applicable authority is reported. */
const ORDER: VenueRoleKind[] = ["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "COMPOUND_ADMIN", "VENUE_MANAGER"];

/**
 * The caller's authority over this venue, or null. `platform` is true
 * for a platform administrator allowed to manage venues.
 */
export function authorityOver(
  caller: { platform: boolean; roles: RoleGrant[] },
  venue: VenueScope,
): VenueAuthority | null {
  if (caller.platform) return "PLATFORM";
  for (const kind of ORDER) {
    const hit = caller.roles.some(
      (r) =>
        r.kind === kind &&
        (((kind === "ORGANIZATION_OWNER" || kind === "ORGANIZATION_ADMIN") && !!venue.organizationId && r.organizationId === venue.organizationId) ||
          (kind === "COMPOUND_ADMIN" && !!venue.compoundId && r.compoundId === venue.compoundId) ||
          (kind === "VENUE_MANAGER" && r.venueId === venue.id)),
    );
    if (hit) return kind;
  }
  return null;
}

export function venueCan(authority: VenueAuthority | null, action: VenueAction): boolean {
  if (!authority) return false;
  return VENUE_PERMISSIONS[authority]?.includes(action) ?? false;
}

/**
 * Gates that belong to a compound serve every venue in it, so only
 * someone with authority over the whole compound edits them.
 */
export function canEditCompoundGates(
  caller: { platform: boolean; roles: RoleGrant[] },
  compound: { id: string; organizationId: string | null },
): boolean {
  if (caller.platform) return true;
  return caller.roles.some(
    (r) =>
      (r.kind === "COMPOUND_ADMIN" && r.compoundId === compound.id) ||
      ((r.kind === "ORGANIZATION_ADMIN" || r.kind === "ORGANIZATION_OWNER") && !!compound.organizationId && r.organizationId === compound.organizationId),
  );
}
