import { db } from "@/lib/db";
import { ABANDONED, startInstant, tally } from "./stats";

/**
 * The reports, counted from booking rows.
 *
 * Every figure here is a count or a sum of things that happened. There
 * is no forecast, no projection and no comparison against a benchmark,
 * because none of those can be derived from a business's own bookings
 * without inventing something.
 *
 * Where a number would be misleading at small volumes it is not hidden
 * — it is labelled. A single completed booking is a real data point;
 * "a 100% completion rate" from it is not.
 */

export interface Period {
  days: number;
  from: Date;
  to: Date;
}

export function lastDays(days: number, now: Date = new Date()): Period {
  return { days, from: new Date(now.getTime() - days * 86_400_000), to: now };
}

const SELECT = {
  status: true,
  totalPrice: true,
  startsAt: true,
  date: true,
  customerId: true,
  createdAt: true,
  currency: true,
  service: { select: { id: true, nameAr: true, nameEn: true } },
  staffMember: { select: { id: true, nameAr: true, nameEn: true } },
} as const;

async function load(businessId: string, period: Period) {
  return db.booking.findMany({
    where: { businessId, createdAt: { gte: period.from, lte: period.to } },
    select: SELECT,
  });
}

function countable(rows: Awaited<ReturnType<typeof load>>) {
  return rows.map((b) => ({
    status: b.status,
    totalPrice: Number(b.totalPrice),
    startsAt: b.startsAt,
    date: b.date,
    customerId: b.customerId,
    createdAt: b.createdAt,
  }));
}

/* ─── Revenue ────────────────────────────────────────────── */

export interface RevenueReport {
  total: number;
  currency: string;
  completedCount: number;
  /** Mean value of a completed appointment. Null when there are none. */
  average: number | null;
  /** Money by day, oldest first, for the period. */
  byDay: { day: string; amount: number }[];
  byService: { name: string; nameEn: string | null; amount: number; count: number }[];
  period: Period;
}

export async function getRevenueReport(
  businessId: string,
  period: Period,
): Promise<RevenueReport> {
  const rows = await load(businessId, period);
  const completed = rows.filter((b) => b.status === "COMPLETED");

  const byDay = new Map<string, number>();
  const byService = new Map<string, { name: string; nameEn: string | null; amount: number; count: number }>();
  let total = 0;

  for (const b of completed) {
    const amount = Number(b.totalPrice);
    total += amount;

    const day = startInstant(b).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + amount);

    const prev = byService.get(b.service.id);
    byService.set(b.service.id, {
      name: b.service.nameAr,
      nameEn: b.service.nameEn,
      amount: (prev?.amount ?? 0) + amount,
      count: (prev?.count ?? 0) + 1,
    });
  }

  return {
    total,
    currency: rows[0]?.currency ?? "EGP",
    completedCount: completed.length,
    average: completed.length > 0 ? total / completed.length : null,
    byDay: [...byDay.entries()]
      .map(([day, amount]) => ({ day, amount }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byService: [...byService.values()].sort((a, b) => b.amount - a.amount),
    period,
  };
}

/* ─── Bookings ───────────────────────────────────────────── */

export interface BookingsReport {
  total: number;
  completed: number;
  cancelled: number;
  noShows: number;
  upcoming: number;
  byDay: { day: string; count: number }[];
  byService: { name: string; nameEn: string | null; count: number }[];
  /** Busiest hours, as "HH" → count, over completed and live bookings. */
  byHour: { hour: number; count: number }[];
  period: Period;
}

export async function getBookingsReport(
  businessId: string,
  period: Period,
  now: Date = new Date(),
): Promise<BookingsReport> {
  const rows = await load(businessId, period);
  const t = tally(countable(rows), now);

  const byDay = new Map<string, number>();
  const byService = new Map<string, { name: string; nameEn: string | null; count: number }>();
  const byHour = new Map<number, number>();

  for (const b of rows) {
    if (ABANDONED.includes(b.status)) continue;

    const at = startInstant(b);
    const day = at.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);

    const prev = byService.get(b.service.id);
    byService.set(b.service.id, {
      name: b.service.nameAr,
      nameEn: b.service.nameEn,
      count: (prev?.count ?? 0) + 1,
    });

    if (b.startsAt) {
      const hour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Cairo",
          hour: "2-digit",
          hour12: false,
        }).format(b.startsAt),
      );
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
  }

  return {
    total: t.total,
    completed: t.completed,
    cancelled: t.cancelled,
    noShows: t.noShows,
    upcoming: t.upcoming,
    byDay: [...byDay.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    byService: [...byService.values()].sort((a, b) => b.count - a.count),
    byHour: [...byHour.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    period,
  };
}

/* ─── Customers ──────────────────────────────────────────── */

export interface CustomersReport {
  totalCustomers: number;
  newInPeriod: number;
  returningInPeriod: number;
  /** Customers with more than one completed visit, all time. */
  repeatCustomers: number;
  /** Mean completed visits per customer who has visited at all. */
  averageVisits: number | null;
  top: { id: string; name: string; visits: number; spend: number }[];
  period: Period;
}

export async function getCustomersReport(
  businessId: string,
  period: Period,
): Promise<CustomersReport> {
  const customers = await db.customer.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      bookings: { select: { status: true, totalPrice: true, createdAt: true } },
    },
  });

  let repeatCustomers = 0;
  let visitedCustomers = 0;
  let totalVisits = 0;
  let newInPeriod = 0;
  let returningInPeriod = 0;

  const ranked: CustomersReport["top"] = [];

  for (const c of customers) {
    const completed = c.bookings.filter((b) => b.status === "COMPLETED");
    const visits = completed.length;
    const spend = completed.reduce((s, b) => s + Number(b.totalPrice), 0);

    if (visits > 0) {
      visitedCustomers++;
      totalVisits += visits;
      if (visits > 1) repeatCustomers++;
      ranked.push({ id: c.id, name: c.name, visits, spend });
    }

    const bookedInPeriod = c.bookings.some(
      (b) => b.createdAt >= period.from && b.createdAt <= period.to,
    );
    if (bookedInPeriod) {
      if (c.createdAt >= period.from) newInPeriod++;
      else returningInPeriod++;
    }
  }

  return {
    totalCustomers: customers.length,
    newInPeriod,
    returningInPeriod,
    repeatCustomers,
    averageVisits: visitedCustomers > 0 ? totalVisits / visitedCustomers : null,
    top: ranked.sort((a, b) => b.spend - a.spend).slice(0, 10),
    period,
  };
}

/* ─── Performance ────────────────────────────────────────── */

export interface PerformanceReport {
  /** Completed as a share of appointments that reached their time. */
  completionRate: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  /** How many bookings these rates are drawn from. */
  sampleSize: number;
  byStaff: {
    id: string;
    name: string;
    nameEn: string | null;
    completed: number;
    noShows: number;
    revenue: number;
  }[];
  byService: { name: string; nameEn: string | null; completed: number; cancelled: number }[];
  period: Period;
}

export async function getPerformanceReport(
  businessId: string,
  period: Period,
): Promise<PerformanceReport> {
  const rows = await load(businessId, period);

  // Only appointments that have reached their moment can be judged: a
  // booking next Tuesday is neither completed nor missed yet, and
  // counting it as "not completed" would make every busy diary look bad.
  const settled = rows.filter(
    (b) =>
      b.status === "COMPLETED" || b.status === "CANCELLED" || b.status === "NO_SHOW",
  );

  const completed = settled.filter((b) => b.status === "COMPLETED").length;
  const cancelled = settled.filter((b) => b.status === "CANCELLED").length;
  const noShows = settled.filter((b) => b.status === "NO_SHOW").length;
  const n = settled.length;

  const byStaff = new Map<string, PerformanceReport["byStaff"][number]>();
  const byService = new Map<string, { name: string; nameEn: string | null; completed: number; cancelled: number }>();

  for (const b of settled) {
    if (b.staffMember) {
      const prev = byStaff.get(b.staffMember.id) ?? {
        id: b.staffMember.id,
        name: b.staffMember.nameAr,
        nameEn: b.staffMember.nameEn,
        completed: 0,
        noShows: 0,
        revenue: 0,
      };
      if (b.status === "COMPLETED") {
        prev.completed++;
        prev.revenue += Number(b.totalPrice);
      }
      if (b.status === "NO_SHOW") prev.noShows++;
      byStaff.set(b.staffMember.id, prev);
    }

    const s = byService.get(b.service.id) ?? {
      name: b.service.nameAr,
      nameEn: b.service.nameEn,
      completed: 0,
      cancelled: 0,
    };
    if (b.status === "COMPLETED") s.completed++;
    if (b.status === "CANCELLED") s.cancelled++;
    byService.set(b.service.id, s);
  }

  return {
    completionRate: n > 0 ? completed / n : null,
    cancellationRate: n > 0 ? cancelled / n : null,
    noShowRate: n > 0 ? noShows / n : null,
    sampleSize: n,
    byStaff: [...byStaff.values()].sort((a, b) => b.completed - a.completed),
    byService: [...byService.values()].sort((a, b) => b.completed - a.completed),
    period,
  };
}
