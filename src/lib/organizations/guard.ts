import type { OrganizationKind } from "@prisma/client";
import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { loadVenueCaller, type VenueCaller } from "@/lib/venues/guard";
import { orgAuthorityOver, orgCan, type OrgAction, type OrgAuthority } from "./access";

/**
 * The server-side gate for every organization route and page. Roles are
 * read from the database per request; a caller without the action gets
 * 404, so pending and suspended organizations are not discoverable.
 */
export async function requireOrgAccess(
  organizationId: string,
  action: OrgAction,
): Promise<{
  caller: VenueCaller;
  organization: { id: string; slug: string; status: string; isPublished: boolean; nameAr: string; nameEn: string | null; kind: OrganizationKind };
  authority: OrgAuthority;
}> {
  const caller = await loadVenueCaller();
  if (!caller) throw err("سجّل دخولك الأول", 401);
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, slug: true, status: true, isPublished: true, nameAr: true, nameEn: true, kind: true },
  });
  if (!organization) throw err("غير موجود", 404);
  const authority = orgAuthorityOver(caller, organizationId);
  if (!orgCan(authority, action)) throw err("غير موجود", 404);
  return { caller, organization, authority: authority! };
}

/** The organizations this caller owns or manages (all, for the platform). */
export async function organizationsFor(caller: VenueCaller) {
  const select = {
    id: true, slug: true, kind: true, nameAr: true, nameEn: true, status: true, isPublished: true, logoImage: true,
    _count: { select: { associations: { where: { status: "APPROVED" as const } }, venues: true } },
  } as const;
  if (caller.platform) return db.organization.findMany({ select, orderBy: { createdAt: "desc" } });
  const ids = caller.roles
    .filter((r) => (r.kind === "ORGANIZATION_OWNER" || r.kind === "ORGANIZATION_ADMIN") && r.organizationId)
    .map((r) => r.organizationId!);
  if (!ids.length) return [];
  return db.organization.findMany({ where: { id: { in: ids } }, select, orderBy: { createdAt: "desc" } });
}
