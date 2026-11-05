import { db } from "@/lib/db";
import { addDays, dateToUTC } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";

/**
 * The daily operations report (Phase 27, modules D–F): one shape that
 * serves a salon (staff, commission, chairs), a restaurant (tables,
 * sections, turnover, party sizes) and a clinic (rooms, service
 * categories). Counts and sums only — no customer appears in it by name
 * or number, so a clinic's report never says who was seen for what.
 */

export interface StaffRow { id: string; name: string; booked: number; completed: number; noShows: number; revenueCents: number; commissionPercent: number | null; commissionCents: number }
export interface ResourceRow { id: string; name: string; area: string | null; capacity: number | null; booked: number; completed: number; guests: number; minutes: number; turnsPerDay: number }
export interface AreaRow { area: string; booked: number; completed: number; guests: number }
export interface GroupRow { group: string; booked: number; completed: number; noShows: number }

export interface OperationsReport {
  from: string;
  to: string;
  days: number;
  totals: { booked: number; completed: number; cancelled: number; noShows: number; walkIns: number; revenueCents: number; noShowRate: number };
  staff: StaffRow[];
  resources: ResourceRow[];
  areas: AreaRow[];
  groups: GroupRow[];
  waitlist: { joined: number; offered: number; booked: number; expired: number };
  packages: { sold: number; soldCents: number; sessionsUsed: number; membershipsActive: number; membershipVisits: number };
}

/** Pure: the report's figures from rows already loaded. */
export function summarise(
  bookings: {
    status: string; totalPrice: number; staffMemberId: string | null; resourceId: string | null; walkIn: boolean;
    partySize: number | null; companions: number; startTime: string; endTime: string | null; groupName: string | null;
  }[],
  staff: { id: string; nameAr: string; commissionPercent: number | null }[],
  resources: { id: string; name: string; area: string | null; capacity: number | null }[],
  days: number,
): Pick<OperationsReport, "totals" | "staff" | "resources" | "areas" | "groups"> {
  const live = (s: string) => s !== "CANCELLED" && s !== "FAILED_PAYMENT";
  const totals = { booked: 0, completed: 0, cancelled: 0, noShows: 0, walkIns: 0, revenueCents: 0, noShowRate: 0 };
  const byStaff = new Map(staff.map((s) => [s.id, { id: s.id, name: s.nameAr, booked: 0, completed: 0, noShows: 0, revenueCents: 0, commissionPercent: s.commissionPercent, commissionCents: 0 }]));
  const byRes = new Map(resources.map((r) => [r.id, { id: r.id, name: r.name, area: r.area, capacity: r.capacity, booked: 0, completed: 0, guests: 0, minutes: 0, turnsPerDay: 0 }]));
  const byGroup = new Map<string, GroupRow>();
  for (const b of bookings) {
    const cents = Math.round(b.totalPrice * 100);
    if (b.status === "CANCELLED") totals.cancelled++;
    if (!live(b.status)) continue;
    totals.booked++;
    if (b.walkIn) totals.walkIns++;
    if (b.status === "COMPLETED") { totals.completed++; totals.revenueCents += cents; }
    if (b.status === "NO_SHOW") totals.noShows++;
    const s = b.staffMemberId ? byStaff.get(b.staffMemberId) : undefined;
    if (s) {
      s.booked++;
      if (b.status === "COMPLETED") { s.completed++; s.revenueCents += cents; }
      if (b.status === "NO_SHOW") s.noShows++;
    }
    const r = b.resourceId ? byRes.get(b.resourceId) : undefined;
    if (r) {
      r.booked++;
      if (b.status === "COMPLETED") {
        r.completed++;
        r.guests += (b.partySize ?? 1) + b.companions;
        if (b.endTime) r.minutes += Math.max(0, timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
      }
    }
    const gname = b.groupName?.trim() || "—";
    const g = byGroup.get(gname) ?? { group: gname, booked: 0, completed: 0, noShows: 0 };
    g.booked++;
    if (b.status === "COMPLETED") g.completed++;
    if (b.status === "NO_SHOW") g.noShows++;
    byGroup.set(gname, g);
  }
  const ended = totals.completed + totals.noShows;
  totals.noShowRate = ended > 0 ? Math.round((totals.noShows / ended) * 1000) / 10 : 0;
  for (const s of byStaff.values()) s.commissionCents = s.commissionPercent ? Math.floor((s.revenueCents * s.commissionPercent) / 100) : 0;
  for (const r of byRes.values()) r.turnsPerDay = days > 0 ? Math.round((r.completed / days) * 10) / 10 : 0;
  const areas = new Map<string, AreaRow>();
  for (const r of byRes.values()) {
    const key = r.area?.trim() || "—";
    const a = areas.get(key) ?? { area: key, booked: 0, completed: 0, guests: 0 };
    a.booked += r.booked; a.completed += r.completed; a.guests += r.guests;
    areas.set(key, a);
  }
  return {
    totals,
    staff: [...byStaff.values()].filter((s) => s.booked > 0).sort((a, b) => b.revenueCents - a.revenueCents),
    resources: [...byRes.values()].filter((r) => r.booked > 0).sort((a, b) => b.completed - a.completed),
    areas: [...areas.values()].filter((a) => a.booked > 0),
    groups: [...byGroup.values()].sort((a, b) => b.booked - a.booked),
  };
}

export async function operationsReport(businessId: string, from: string, days: number): Promise<OperationsReport> {
  const n = Math.max(1, Math.min(31, Math.floor(days)));
  const to = addDays(from, n - 1);
  const range = { gte: dateToUTC(from), lte: dateToUTC(to) };
  const rangeInstant = { gte: dateToUTC(from), lt: dateToUTC(addDays(to, 1)) };
  const [bookings, staff, resources, waitlist, sold, used, membershipsActive, membershipVisits] = await Promise.all([
    db.booking.findMany({
      where: { businessId, isTest: false, date: range },
      select: {
        status: true, totalPrice: true, staffMemberId: true, resourceId: true, walkIn: true, partySize: true,
        companions: true, startTime: true, endTime: true, service: { select: { groupName: true } },
      },
      take: 20_000,
    }),
    db.staffMember.findMany({ where: { businessId }, select: { id: true, nameAr: true, commissionPercent: true } }),
    db.resource.findMany({ where: { businessId }, select: { id: true, name: true, area: true, capacity: true } }),
    db.slotWaitlistEntry.groupBy({ by: ["status"], where: { businessId, date: range }, _count: { _all: true } }),
    db.customerPackage.aggregate({ where: { businessId, createdAt: rangeInstant, status: { not: "PENDING_PAYMENT" } }, _count: { _all: true }, _sum: { priceCents: true } }),
    db.entitlementUse.count({ where: { packageId: { not: null }, reversedAt: null, booking: { businessId, date: range } } }),
    db.customerMembership.count({ where: { businessId, status: "ACTIVE" } }),
    db.entitlementUse.count({ where: { membershipId: { not: null }, reversedAt: null, booking: { businessId, date: range } } }),
  ]);
  const base = summarise(
    bookings.map((b) => ({ ...b, totalPrice: Number(b.totalPrice), groupName: b.service.groupName })),
    staff,
    resources,
    n,
  );
  const w = Object.fromEntries(waitlist.map((g) => [g.status, g._count._all])) as Record<string, number>;
  return {
    from, to, days: n, ...base,
    waitlist: {
      joined: waitlist.reduce((s, g) => s + g._count._all, 0),
      offered: w.OFFERED ?? 0,
      booked: w.BOOKED ?? 0,
      expired: w.EXPIRED ?? 0,
    },
    packages: {
      sold: sold._count._all,
      soldCents: sold._sum.priceCents ?? 0,
      sessionsUsed: used,
      membershipsActive,
      membershipVisits,
    },
  };
}

/**
 * The report without money: no revenue, no per-staff revenue or
 * commission. For whoever may read reports but not finance — a
 * management company granted REPORTS, which the database deliberately
 * keeps from FINANCE (final audit F-20).
 */
export type OperationsCounts = Omit<OperationsReport, "totals" | "staff"> & {
  totals: Omit<OperationsReport["totals"], "revenueCents">;
  staff: Omit<StaffRow, "revenueCents" | "commissionPercent" | "commissionCents">[];
  money: false;
};

export function withoutMoney(r: OperationsReport): OperationsCounts {
  const { revenueCents: _revenue, ...totals } = r.totals;
  void _revenue;
  return {
    ...r,
    totals,
    staff: r.staff
      .map(({ revenueCents: _r, commissionPercent: _p, commissionCents: _c, ...rest }) => (void _r, void _p, void _c, rest))
      .sort((a, b) => b.completed - a.completed),
    money: false,
  };
}
