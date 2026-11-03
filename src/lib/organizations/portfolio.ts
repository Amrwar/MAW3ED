import type { BookingStatus, DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDay, cairoDayBefore } from "@/lib/attribution/day";

/**
 * A group's report across the businesses it owns or manages.
 *
 * Only what each business owner chose to share: a business appears with
 * figures when its relationship grants REPORTS (or FINANCE, which
 * includes it), and with money only when it grants FINANCE. Everything
 * else is listed by name as "not shared", so the group sees the gap
 * rather than a misleading total. A relationship limited to one branch
 * never carries reports (they are business-wide: lib/organizations/
 * scopes.ts), so it is listed as not shared. Hosted businesses (a mall's
 * tenants) are never here: hosting is a listing, not a reporting line.
 *
 * Counts and sums only — never a customer, a booking or a price of one
 * booking. Test bookings are left out, as in the business's own report.
 */

const REPORTED = ["OWNED", "MANAGED"] as const satisfies readonly OrganizationBusinessRelation[];

export interface PortfolioFigures {
  bookings: number;
  upcoming: number;
  completed: number;
  noShows: number;
  cancelled: number;
  /** Sum of completed bookings' prices; null without FINANCE. */
  revenue: number | null;
}

export interface PortfolioRow {
  associationId: string;
  relation: OrganizationBusinessRelation;
  business: { id: string; slug: string; nameAr: string; nameEn: string | null };
  branch: { nameAr: string; nameEn: string | null } | null;
  /** Null when the business has not shared its reports with this organization. */
  figures: PortfolioFigures | null;
}

export interface PortfolioReport {
  windowDays: number;
  from: string;
  to: string;
  rows: PortfolioRow[];
  /** Over the sharing businesses, each once; revenue over those that also share finance. */
  totals: PortfolioFigures & { sharing: number; withFinance: number };
}

const UPCOMING: BookingStatus[] = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"];

export function sharesReports(a: { scopes: readonly DelegationScope[]; branchId: string | null }): boolean {
  return a.branchId === null && (a.scopes.includes("REPORTS") || a.scopes.includes("FINANCE"));
}

type Bucket = { businessId: string; status: BookingStatus; n: number; revenue: number };

/** Pure: one business's figures from the grouped counts. Exported for tests. */
export function figuresFor(buckets: readonly Bucket[], businessId: string, finance: boolean): PortfolioFigures {
  const mine = buckets.filter((b) => b.businessId === businessId);
  const count = (s: readonly BookingStatus[]) => mine.filter((b) => s.includes(b.status)).reduce((n, b) => n + b.n, 0);
  return {
    // Cancelled and failed payments are not bookings that happened; the
    // business's own report counts the same way.
    bookings: count(["PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"]),
    upcoming: count(UPCOMING),
    completed: count(["COMPLETED"]),
    noShows: count(["NO_SHOW"]),
    cancelled: count(["CANCELLED"]),
    revenue: finance ? mine.filter((b) => b.status === "COMPLETED").reduce((n, b) => n + b.revenue, 0) : null,
  };
}

export async function organizationPortfolio(organizationId: string, windowDays = 30, now = new Date()): Promise<PortfolioReport> {
  const from = cairoDayBefore(windowDays - 1, now);
  const to = cairoDay(now);
  const organization = await db.organization.findUnique({ where: { id: organizationId }, select: { status: true } });
  // A grant operates only through an approved organization (as delegation does).
  const live = organization?.status === "APPROVED";
  const associations = await db.organizationBusiness.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      relation: { in: [...REPORTED] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 500,
    select: {
      id: true, relation: true, scopes: true, branchId: true,
      branch: { select: { nameAr: true, nameEn: true } },
      business: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
    },
  });
  const shared = live ? associations.filter(sharesReports) : [];
  const ids = [...new Set(shared.map((a) => a.business.id))];
  const grouped = ids.length
    ? await db.booking.groupBy({
        by: ["businessId", "status"],
        where: { businessId: { in: ids }, isTest: false, date: { gte: from, lte: to } },
        _count: { _all: true },
        _sum: { totalPrice: true },
      })
    : [];
  const buckets: Bucket[] = grouped.map((g) => ({
    businessId: g.businessId,
    status: g.status,
    n: g._count._all,
    revenue: Number(g._sum.totalPrice ?? 0),
  }));

  // A business may hold two reporting relationships with one organization
  // (owned and managed): its figures are counted once in the totals.
  const finance = new Set(shared.filter((a) => a.scopes.includes("FINANCE")).map((a) => a.business.id));
  const rows: PortfolioRow[] = associations.map((a) => ({
    associationId: a.id,
    relation: a.relation,
    business: a.business,
    branch: a.branch,
    figures: live && sharesReports(a) ? figuresFor(buckets, a.business.id, a.scopes.includes("FINANCE")) : null,
  }));
  const totals = { bookings: 0, upcoming: 0, completed: 0, noShows: 0, cancelled: 0, revenue: null as number | null, sharing: ids.length, withFinance: finance.size };
  for (const id of ids) {
    const f = figuresFor(buckets, id, finance.has(id));
    totals.bookings += f.bookings;
    totals.upcoming += f.upcoming;
    totals.completed += f.completed;
    totals.noShows += f.noShows;
    totals.cancelled += f.cancelled;
    if (f.revenue !== null) totals.revenue = (totals.revenue ?? 0) + f.revenue;
  }

  return { windowDays, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), rows, totals };
}
