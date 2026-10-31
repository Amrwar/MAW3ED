import type { DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { db } from "@/lib/db";
import type { BusinessAction } from "@/lib/business-access";
import { ACTING_COOKIE } from "./acting-paths";
import { DELEGATION_SCOPES } from "./scopes";

export { ACTING_COOKIE };

/**
 * Delegated management: what an organization's people may do inside a
 * business they do not own an account of.
 *
 * Three relationship types, and only two of them ever operate anything:
 *
 *   OWNED   — the organization owns or controls the business. Its people
 *             may operate it within the scopes the business granted.
 *             Owning it on paper grants nothing by itself.
 *   HOSTED  — a mall, compound or building where an independent business
 *             trades. Directory only: no scope can ever be granted (the
 *             database refuses it too).
 *   MANAGED — an outside company runs selected functions, under granted
 *             scopes, optionally until an expiry date.
 *
 * Access is the intersection of three things, all re-read from the
 * database on every request:
 *
 *   the business granted the scope on an APPROVED, unexpired relationship;
 *   the organization is APPROVED by the platform;
 *   the person holds an owner or manager role in that organization.
 *
 * Clearing a scope, suspending the relationship, removing a member or
 * suspending the organization therefore ends access on the next request.
 */

export { DELEGATION_SCOPES, RELATIONSHIPS, SCOPE_LABELS, RELATIONSHIP_LABELS, allowedScopes, checkScopes } from "./scopes";
export type { Relationship } from "./scopes";

/** What each scope lets a delegate do, in the business's own action words. */
export const SCOPE_ACTIONS: Record<DelegationScope, readonly BusinessAction[]> = {
  // Running the diary needs to see what is booked, with whom and when.
  RESERVATIONS: [
    "bookings.read", "bookings.readAll", "bookings.confirm", "bookings.progress",
    "bookings.cancel", "bookings.reschedule", "bookings.create",
    "services.read", "staff.read", "schedule.read",
  ],
  CUSTOMERS: ["customers.read", "customers.manage"],
  SERVICES: ["services.read", "services.manage"],
  // Staff records, each person's own hours and time off — never who may
  // sign in (staff.manageAccess stays the owner's).
  STAFF: ["staff.read", "staff.manage"],
  // The business's opening hours and business-wide closures.
  SCHEDULES: ["schedule.read", "schedule.manage"],
  PROFILE: ["profile.read", "profile.manage"],
  REPORTS: ["reports.read"],
  FINANCE: ["finance.read", "reports.read"],
};

/** The business actions a set of scopes adds up to. */
export function actionsFor(scopes: readonly DelegationScope[]): BusinessAction[] {
  return [...new Set(scopes.flatMap((s) => SCOPE_ACTIONS[s]))];
}

export interface Delegation {
  /** Everything the person may do in this business. */
  actions: BusinessAction[];
  scopes: DelegationScope[];
  /**
   * Bookings visible to them: null for the whole business, or the
   * branches of branch-limited relationships when no relationship
   * covers the whole business.
   */
  branchIds: string[] | null;
  /** Which organizations the access comes through, for the banner and the audit. */
  via: { associationId: string; organizationId: string; organizationName: string; relation: OrganizationBusinessRelation; scopes: DelegationScope[]; expiresAt: Date | null }[];
}

/** The live, operable relationships of a person, optionally for one business. */
function operableWhere(userId: string, now: Date, businessId?: string) {
  return {
    ...(businessId ? { businessId } : {}),
    status: "APPROVED" as const,
    relation: { in: ["OWNED", "MANAGED"] as OrganizationBusinessRelation[] },
    scopes: { isEmpty: false },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    organization: {
      status: "APPROVED" as const,
      roles: { some: { userId, kind: { in: ["ORGANIZATION_OWNER" as const, "ORGANIZATION_ADMIN" as const] } } },
    },
  };
}

/**
 * What `userId` may do in `businessId` through organizations, or null.
 * Several relationships (an owning group and a managing company, say)
 * add up; a branch-limited one adds only its own branch's bookings.
 */
export async function resolveDelegation(userId: string, businessId: string, now = new Date()): Promise<Delegation | null> {
  const rows = await db.organizationBusiness.findMany({
    where: operableWhere(userId, now, businessId),
    select: {
      id: true, relation: true, scopes: true, branchId: true, expiresAt: true,
      organization: { select: { id: true, nameAr: true } },
    },
  });
  if (!rows.length) return null;
  const scopes = DELEGATION_SCOPES.filter((s) => rows.some((r) => r.scopes.includes(s)));
  const reservationsWide = rows.some((r) => !r.branchId && r.scopes.includes("RESERVATIONS"));
  const branchIds = reservationsWide
    ? null
    : [...new Set(rows.filter((r) => r.branchId && r.scopes.includes("RESERVATIONS")).map((r) => r.branchId as string))];
  return {
    actions: actionsFor(scopes),
    scopes,
    branchIds: branchIds && branchIds.length ? branchIds : null,
    via: rows.map((r) => ({
      associationId: r.id,
      organizationId: r.organization.id,
      organizationName: r.organization.nameAr,
      relation: r.relation,
      scopes: r.scopes,
      expiresAt: r.expiresAt,
    })),
  };
}

/** Every business a person may operate, for the organization console's portfolio. */
export async function operableBusinesses(userId: string, now = new Date()) {
  const rows = await db.organizationBusiness.findMany({
    where: operableWhere(userId, now),
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true, relation: true, scopes: true, expiresAt: true, organizationId: true,
      business: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
      branch: { select: { nameAr: true, nameEn: true } },
    },
  });
  return rows;
}

/* ─── Acting context ─────────────────────────────────────────── */

/*
 * The business a delegate chose to operate is carried in a cookie
 * (ACTING_COOKIE). The cookie names a business and nothing else: whether
 * its holder may operate it is decided from the database on every
 * request, so a forged or stale cookie grants nothing.
 */

/** The acting business id from the current request, or null outside one. */
export async function readActingBusinessId(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const v = (await cookies()).get(ACTING_COOKIE)?.value;
    return v && /^[a-z0-9]{10,40}$/i.test(v) ? v : null;
  } catch {
    // Outside a request (tests, scripts): no acting context.
    return null;
  }
}
