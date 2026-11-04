import type { DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * What an organization may see through its integrations — the same rule
 * the organization console follows (docs/enterprise/PERMISSION_MATRIX.md):
 *
 *   - a business it is APPROVED with, the association not suspended or
 *     expired;
 *   - its bookings only where the organization OWNS or MANAGES the
 *     business AND the business granted RESERVATIONS — never for a
 *     business the organization merely HOSTS (a mall sees its tenants,
 *     not their customers' appointments);
 *   - limited to the branch, where the association is for one branch;
 *   - never a customer's name, phone or email: payloads carry ids, times
 *     and statuses.
 */

export interface VisibleBusiness {
  businessId: string;
  relation: OrganizationBusinessRelation;
  scopes: DelegationScope[];
  /** Null: the whole business. Otherwise only these branches. */
  branchIds: string[] | null;
}

export async function visibleBusinesses(organizationId: string, now: Date = new Date()): Promise<VisibleBusiness[]> {
  const rows = await db.organizationBusiness.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      suspendedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      relation: { in: ["OWNED", "HOSTED", "MANAGED"] },
    },
    select: { businessId: true, relation: true, scopes: true, branchId: true },
  });
  const byBusiness = new Map<string, VisibleBusiness>();
  for (const r of rows) {
    const v = byBusiness.get(r.businessId) ?? { businessId: r.businessId, relation: r.relation, scopes: [], branchIds: [] as string[] | null };
    // The strongest relation wins for listing; scopes add up.
    if (rank(r.relation) > rank(v.relation)) v.relation = r.relation;
    v.scopes = [...new Set([...v.scopes, ...r.scopes])];
    if (r.branchId === null) v.branchIds = null;
    else if (v.branchIds) v.branchIds.push(r.branchId);
    byBusiness.set(r.businessId, v);
  }
  return [...byBusiness.values()];
}

const rank = (r: OrganizationBusinessRelation) => (r === "OWNED" ? 3 : r === "MANAGED" ? 2 : r === "HOSTED" ? 1 : 0);

/** Pure: may the organization see this business's bookings? */
export function seesBookings(v: Pick<VisibleBusiness, "relation" | "scopes">): boolean {
  return (v.relation === "OWNED" || v.relation === "MANAGED") && v.scopes.includes("RESERVATIONS");
}

/** Pure: may it see this business's figures (counts; money needs FINANCE)? */
export function seesReports(v: Pick<VisibleBusiness, "scopes">): { counts: boolean; money: boolean } {
  return { counts: v.scopes.includes("REPORTS"), money: v.scopes.includes("FINANCE") };
}
