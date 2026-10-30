import type { VenueRoleKind } from "@prisma/client";

/**
 * Who may do what in an organization.
 *
 * Three authorities, from the same role rows the venue side uses
 * (`VenueRole` scoped to the organization):
 *
 *   PLATFORM  a Maw3ed administrator with "venues.manage"
 *   OWNER     ORGANIZATION_OWNER — the account the organization belongs to
 *   MANAGER   ORGANIZATION_ADMIN — appointed by the owner
 *
 * Only the platform reviews (approve / reject / suspend). Only the
 * platform and the owner publish the page or manage members: a manager
 * must not be able to appoint managers or put the page in front of the
 * public. Nobody here gains any access to a business's own records —
 * organization metrics are counts (lib/organizations/public.ts).
 *
 * Pure, so the whole matrix is tested without a database.
 */

export type OrgAuthority = "PLATFORM" | "OWNER" | "MANAGER";

export const ORG_ACTIONS = [
  "org.view",
  "org.edit",
  "org.associations.manage",
  "org.directory.organize",
  "org.venues.create",
  "org.metrics",
  "org.audit",
  // Owner (and platform) only.
  "org.publish",
  "org.members",
  // Platform only.
  "org.review",
] as const;

export type OrgAction = (typeof ORG_ACTIONS)[number];

const MANAGER: OrgAction[] = [
  "org.view",
  "org.edit",
  "org.associations.manage",
  "org.directory.organize",
  "org.venues.create",
  "org.metrics",
  "org.audit",
];

export const ORG_PERMISSIONS: Record<OrgAuthority, readonly OrgAction[]> = {
  PLATFORM: ORG_ACTIONS,
  OWNER: [...MANAGER, "org.publish", "org.members"],
  MANAGER,
};

export interface OrgRoleGrant {
  kind: VenueRoleKind;
  organizationId: string | null;
}

export function orgAuthorityOver(
  caller: { platform: boolean; roles: OrgRoleGrant[] },
  organizationId: string,
): OrgAuthority | null {
  if (caller.platform) return "PLATFORM";
  if (caller.roles.some((r) => r.kind === "ORGANIZATION_OWNER" && r.organizationId === organizationId)) return "OWNER";
  if (caller.roles.some((r) => r.kind === "ORGANIZATION_ADMIN" && r.organizationId === organizationId)) return "MANAGER";
  return null;
}

export function orgCan(authority: OrgAuthority | null, action: OrgAction): boolean {
  if (!authority) return false;
  return ORG_PERMISSIONS[authority]?.includes(action) ?? false;
}
