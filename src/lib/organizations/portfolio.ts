import type { BookingStatus, DelegationScope, OrganizationBusinessRelation } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDay, cairoDayBefore } from "@/lib/attribution/day";
import { cairoWallClock } from "@/lib/bookings/instants";
import { ABANDONED, LIVE_STATUSES } from "@/lib/dashboard/stats";

/**
 * A group's report across the businesses it owns or manages.
 *
 * Only what each business owner chose to share: a business shows figures
 * when one of its business-wide relationships grants REPORTS (or FINANCE,
 * which includes it), and money only with FINANCE. The others are listed
 * by name with the reason they show nothing, so the group sees the gap
 * rather than a misleading total. A relationship limited to one branch
 * never carries reports (they are business-wide: lib/organizations/
 * scopes.ts). Hosted businesses (a mall's tenants) are never here:
 * hosting is a listing, not a reporting line. An organization that is not
 * approved reports nothing at all, as delegation does.
 *
 * Counts follow the business's own report (lib/dashboard/stats.ts):
 * abandoned checkouts are counted nowhere, the total includes cancelled
 * bookings, revenue is over completed ones. Totals, completed, no-shows
 * and revenue cover bookings dated in the window; "upcoming" is live
 * bookings still ahead, whenever they are. Counts and sums only — never a
 * customer or a single booking. Test bookings are left out.
 */

const REPORTED = ["OWNED", "MANAGED"] as const satisfies readonly OrganizationBusinessRelation[];
/** Rows read at most; `truncated` says when there were more. */
export const PORTFOLIO_LIMIT = 500;

export interface PortfolioFigures {
  /** Every booking in the window except abandoned checkouts. */
  bookings: number;
  /** Live bookings that have not started yet. */
  upcoming: number;
  completed: number;
  noShows: number;
  cancelled: number;
  /** Sum of completed bookings' prices; null without FINANCE. */
  revenue: number | null;
}

/** Why a row has no figures. */
export type NotShared = "not-granted" | "branch-only";

export interface PortfolioRow {
  business: { id: string; slug: string; nameAr: string; nameEn: string | null };
  /** Every live reporting relationship this organization has with it. */
  relations: { associationId: string; relation: OrganizationBusinessRelation; branch: { nameAr: string; nameEn: string | null } | null }[];
  figures: PortfolioFigures | null;
  notShared: NotShared | null;
}

export interface PortfolioReport {
  windowDays: number;
  from: string;
  to: string;
  /** False when the organization is not approved: nothing is reported. */
  active: boolean;
  /** More relationships exist than were read. */
  truncated: boolean;
  /** One per business. */
  rows: PortfolioRow[];
  /** Over the businesses that share; revenue over those that also share finance. */
  totals: PortfolioFigures & { sharing: number; withFinance: number };
}

type Grant = { scopes: readonly DelegationScope[]; branchId: string | null };
export function sharesReports(a: Grant): boolean {
  return a.branchId === null && (a.scopes.includes("REPORTS") || a.scopes.includes("FINANCE"));
}
export function sharesFinance(a: Grant): boolean {
  return a.branchId === null && a.scopes.includes("FINANCE");
}

/** Pure: one business's figures from its status counts, by the business report's rules. Exported for tests. */
export function figuresFrom(
  inWindow: ReadonlyMap<BookingStatus, { n: number; revenue: number }>,
  upcoming: number,
  finance: boolean,
): PortfolioFigures {
  const n = (s: BookingStatus) => inWindow.get(s)?.n ?? 0;
  let bookings = 0;
  for (const [status, v] of inWindow) if (!ABANDONED.includes(status)) bookings += v.n;
  return {
    bookings,
    upcoming,
    completed: n("COMPLETED"),
    noShows: n("NO_SHOW"),
    cancelled: n("CANCELLED"),
    revenue: finance ? (inWindow.get("COMPLETED")?.revenue ?? 0) : null,
  };
}

export async function organizationPortfolio(organizationId: string, windowDays = 30, now = new Date(), limit = PORTFOLIO_LIMIT): Promise<PortfolioReport> {
  const from = cairoDayBefore(windowDays - 1, now);
  const to = cairoDay(now);
  const empty = { bookings: 0, upcoming: 0, completed: 0, noShows: 0, cancelled: 0, revenue: null, sharing: 0, withFinance: 0 };
  const base = { windowDays, from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };

  const organization = await db.organization.findUnique({ where: { id: organizationId }, select: { status: true } });
  // A grant operates only through an approved organization (as delegation
  // does); a suspended one is not even told who granted what.
  if (organization?.status !== "APPROVED") return { ...base, active: false, truncated: false, rows: [], totals: empty };

  const associations = await db.organizationBusiness.findMany({
    where: {
      organizationId,
      status: "APPROVED",
      relation: { in: [...REPORTED] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit + 1,
    select: {
      id: true, relation: true, scopes: true, branchId: true,
      branch: { select: { nameAr: true, nameEn: true } },
      business: { select: { id: true, slug: true, nameAr: true, nameEn: true } },
    },
  });
  const truncated = associations.length > limit;
  const list = associations.slice(0, limit);

  // One row per business, however many relationships it has with us.
  const byBusiness = new Map<string, typeof list>();
  for (const a of list) byBusiness.set(a.business.id, [...(byBusiness.get(a.business.id) ?? []), a]);
  const sharing = [...byBusiness].filter(([, as]) => as.some(sharesReports)).map(([id]) => id);

  const [inWindow, ahead] = sharing.length
    ? await Promise.all([
        db.booking.groupBy({
          by: ["businessId", "status"],
          where: { businessId: { in: sharing }, isTest: false, date: { gte: from, lte: to } },
          _count: { _all: true },
          _sum: { totalPrice: true },
        }),
        db.booking.groupBy({
          by: ["businessId"],
          // startsAt is Cairo wall-clock written as UTC (lib/bookings/instants).
          where: { businessId: { in: sharing }, isTest: false, status: { in: [...LIVE_STATUSES] }, startsAt: { gt: cairoWallClock(now) } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const counts = new Map<string, Map<BookingStatus, { n: number; revenue: number }>>();
  for (const g of inWindow) {
    const m = counts.get(g.businessId) ?? new Map();
    m.set(g.status, { n: g._count._all, revenue: Number(g._sum.totalPrice ?? 0) });
    counts.set(g.businessId, m);
  }
  const upcoming = new Map(ahead.map((g) => [g.businessId, g._count._all]));

  const totals = { ...empty, revenue: null as number | null, sharing: sharing.length };
  const rows: PortfolioRow[] = [...byBusiness].map(([id, as]) => {
    const shares = as.some(sharesReports);
    const finance = as.some(sharesFinance);
    const figures = shares ? figuresFrom(counts.get(id) ?? new Map(), upcoming.get(id) ?? 0, finance) : null;
    if (figures) {
      totals.bookings += figures.bookings;
      totals.upcoming += figures.upcoming;
      totals.completed += figures.completed;
      totals.noShows += figures.noShows;
      totals.cancelled += figures.cancelled;
      if (figures.revenue !== null) {
        totals.revenue = (totals.revenue ?? 0) + figures.revenue;
        totals.withFinance += 1;
      }
    }
    return {
      business: as[0].business,
      relations: as.map((a) => ({ associationId: a.id, relation: a.relation, branch: a.branch })),
      figures,
      notShared: shares ? null : as.every((a) => a.branchId !== null) ? "branch-only" : "not-granted",
    };
  });

  return { ...base, active: true, truncated, rows, totals };
}
