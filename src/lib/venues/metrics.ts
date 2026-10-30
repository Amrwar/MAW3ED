import { db } from "@/lib/db";

/**
 * What a venue may know about activity inside it: counts.
 *
 * Bookings at the venue's approved tenants are counted — by status, and
 * in total — and nothing else is returned: no names, phones, notes,
 * services, prices or payments. A clinic in a mall does not tell the
 * mall who its patients are. A branch-level membership counts that
 * branch's bookings only; a business-level one counts the business's.
 * Owners' test bookings are never counted, and neither is anything from
 * before the venue listed the business: its history before joining is
 * not the venue's to see.
 */
export interface VenueMetrics {
  windowDays: number;
  tenants: { approved: number; requested: number };
  bookings: { total: number; byStatus: Record<string, number> };
}

export async function venueMetrics(venueId: string, windowDays = 30, now = new Date()): Promise<VenueMetrics> {
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const members = await db.venueMembership.findMany({
    where: { venueId, status: { in: ["APPROVED", "REQUESTED"] } },
    select: { status: true, businessId: true, branchId: true, decidedAt: true },
  });
  const approved = members.filter((m) => m.status === "APPROVED");
  const scopes = approved.map((m) => ({
    businessId: m.businessId,
    ...(m.branchId ? { branchId: m.branchId } : {}),
    createdAt: { gte: m.decidedAt && m.decidedAt > since ? m.decidedAt : since },
  }));

  const grouped = scopes.length
    ? await db.booking.groupBy({
        by: ["status"],
        where: { isTest: false, OR: scopes },
        _count: { _all: true },
      })
    : [];
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  return {
    windowDays,
    tenants: { approved: approved.length, requested: members.length - approved.length },
    bookings: { total: grouped.reduce((n, g) => n + g._count._all, 0), byStatus },
  };
}
