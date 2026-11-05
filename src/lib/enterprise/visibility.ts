import type { DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * What an organization may see through its integrations — the same rule
 * the organization console follows (docs/enterprise/PERMISSION_MATRIX.md,
 * lib/organizations/delegation.ts):
 *
 *   - a business it is APPROVED with, the association not suspended or
 *     expired;
 *   - its bookings only through an association row that is itself OWNED or
 *     MANAGED **and** grants RESERVATIONS — never through a HOSTED row (a
 *     mall sees its tenants, not their customers' appointments) and never
 *     by combining one row's relation with another row's scopes;
 *   - limited to the branches those granting rows name (a whole-business
 *     granting row means every branch);
 *   - never a customer's name, phone or email: payloads carry ids, times
 *     and statuses.
 */

export interface AssociationRow {
  relation: OrganizationBusinessRelation;
  scopes: DelegationScope[];
  branchId: string | null;
}

export interface VisibleBusiness {
  businessId: string;
  /** The strongest relationship, for listing. */
  relation: OrganizationBusinessRelation;
  /** Every scope any row grants, for listing only — never for access. */
  scopes: DelegationScope[];
  /** Bookings: null = none; otherwise the branches (null = all branches). */
  bookings: { branchIds: string[] | null } | null;
}

/** Pure: does this one association row grant bookings? */
export function rowGrantsBookings(r: Pick<AssociationRow, "relation" | "scopes">): boolean {
  return (r.relation === "OWNED" || r.relation === "MANAGED") && r.scopes.includes("RESERVATIONS");
}

/** Pure: what a business's rows add up to — each row's grants stay its own. */
export function combineRows(businessId: string, rows: AssociationRow[]): VisibleBusiness {
  const rank = (r: OrganizationBusinessRelation) => (r === "OWNED" ? 3 : r === "MANAGED" ? 2 : r === "HOSTED" ? 1 : 0);
  let relation = rows[0].relation;
  for (const r of rows) if (rank(r.relation) > rank(relation)) relation = r.relation;
  const granting = rows.filter(rowGrantsBookings);
  const bookings = granting.length === 0
    ? null
    : granting.some((r) => r.branchId === null)
    ? { branchIds: null }
    : { branchIds: [...new Set(granting.map((r) => r.branchId!))] };
  return { businessId, relation, scopes: [...new Set(rows.flatMap((r) => r.scopes))], bookings };
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
  const byBusiness = new Map<string, AssociationRow[]>();
  for (const r of rows) byBusiness.set(r.businessId, [...(byBusiness.get(r.businessId) ?? []), r]);
  return [...byBusiness.entries()].map(([id, list]) => combineRows(id, list));
}

/** May the organization see this business's bookings (at some branch)? */
export function seesBookings(v: Pick<VisibleBusiness, "bookings">): boolean {
  return v.bookings !== null;
}

/** Pure: may it see this business's figures (counts; money needs FINANCE)? */
export function seesReports(v: Pick<VisibleBusiness, "scopes">): { counts: boolean; money: boolean } {
  return { counts: v.scopes.includes("REPORTS"), money: v.scopes.includes("FINANCE") };
}
