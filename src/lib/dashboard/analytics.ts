import type { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ABANDONED } from "@/lib/dashboard/stats";
import { cairoDateString } from "@/lib/bookings/instants";

/**
 * The business analytics page: one calculation, used by the page's first
 * render and by its API, so the two can never disagree (they used to be
 * two copies).
 *
 * Rules, the same as lib/dashboard/stats.ts:
 *   - abandoned checkouts (PENDING_PAYMENT, FAILED_PAYMENT) and cancelled
 *     bookings are not bookings; test bookings never count;
 *   - "completed booking value" is the price of COMPLETED bookings. It is
 *     not cash collected (a completed visit paid at the counter counts, a
 *     refund is not subtracted), and it is labelled for what it is;
 *   - a repeat customer has more than one COMPLETED booking with this
 *     business, ever (reports.ts uses the same rule);
 *   - a ratio with nothing to divide by is null ("no data"), never 0.
 *
 * Booking.date is the Cairo calendar day stored at UTC midnight
 * (lib/bookings/instants.ts), so UTC calendar arithmetic on it is the
 * Cairo calendar.
 */

export type RevenuePoint = { period: string; revenue: number; bookings: number };
export type ServiceSlice = { serviceName: string; bookings: number; revenue: number; color: string };
export type HeatCell = { day: number; hour: number; count: number };

export type AnalyticsPayload = {
  kpis: {
    totalBookings: number;
    completedRevenue: number;
    /** null when nothing was completed in the range. */
    avgBookingValue: number | null;
    /** null when no identified customer booked in the range. */
    repeatCustomerRate: number | null;
    currency: string;
    /** More than one currency in the range: the sums are not comparable. */
    mixedCurrency: boolean;
  };
  revenueByPeriod: RevenuePoint[];
  bookingsByService: ServiceSlice[];
  heatmap: HeatCell[];
  granularity: "day" | "week" | "month";
};

export type AnalyticsRow = {
  date: Date;
  startTime: string;
  status: BookingStatus;
  totalPrice: number;
  currency: string;
  customerId: string | null;
  serviceId: string;
  serviceNameAr: string;
  serviceNameEn: string | null;
};

/** Statuses never counted on this page. */
export const EXCLUDED_STATUSES: readonly BookingStatus[] = [...ABANDONED, "CANCELLED"];

const SERVICE_COLORS = [
  "var(--color-jade)", "var(--color-star)", "var(--color-ok)", "var(--color-danger)", "var(--color-info)",
  "var(--color-warn)", "#6366f1", "#3b82f6", "#ef4444", "#f59e0b",
];

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** Monday of the week holding `d` (a UTC-midnight calendar day). */
export function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

export function granularityFor(from: Date, to: Date): "day" | "week" | "month" {
  const days = Math.round((to.getTime() - from.getTime()) / DAY) + 1;
  return days <= 31 ? "day" : days <= 92 ? "week" : "month";
}

/** "YYYY-MM-DD" → UTC midnight of that calendar day. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** The first day of the current Cairo month and today, as "YYYY-MM-DD". */
export function thisCairoMonth(now: Date = new Date()): { from: string; to: string } {
  const today = cairoDateString(now);
  return { from: `${today.slice(0, 8)}01`, to: today };
}

/**
 * Pure: the page's figures from rows already filtered to the range and to
 * counted statuses. `repeaters` is the set of customers in the range with
 * more than one completed booking ever.
 */
export function computeAnalytics(
  rows: AnalyticsRow[],
  range: { from: Date; to: Date },
  repeaters: ReadonlySet<string>,
  lang: "ar" | "en" = "ar",
): AnalyticsPayload {
  const counted = rows.filter((r) => !EXCLUDED_STATUSES.includes(r.status));
  const currencies = new Set(counted.map((r) => r.currency));
  const currency = counted[0]?.currency ?? "EGP";

  const completed = counted.filter((r) => r.status === "COMPLETED");
  const completedRevenue = completed.reduce((s, r) => s + r.totalPrice, 0);

  const customers = new Set(counted.map((r) => r.customerId).filter((c): c is string => !!c));
  const repeatCount = [...customers].filter((c) => repeaters.has(c)).length;

  const granularity = granularityFor(range.from, range.to);
  const keyOf = (d: Date) =>
    granularity === "day" ? isoDay(d) : granularity === "week" ? isoDay(mondayOf(d)) : isoDay(d).slice(0, 7);

  // Every period in the range, so a quiet day shows as zero, not a gap.
  const periods = new Map<string, { revenue: number; bookings: number }>();
  const start = granularity === "week" ? mondayOf(range.from) : new Date(range.from);
  if (granularity === "month") start.setUTCDate(1);
  for (let d = start; d <= range.to; ) {
    periods.set(keyOf(d), { revenue: 0, bookings: 0 });
    if (granularity === "day") d.setUTCDate(d.getUTCDate() + 1);
    else if (granularity === "week") d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }

  const services = new Map<string, { name: string; bookings: number; revenue: number }>();
  const heat = new Map<string, number>();
  for (const r of counted) {
    const p = periods.get(keyOf(r.date));
    if (p) {
      p.bookings += 1;
      if (r.status === "COMPLETED") p.revenue += r.totalPrice;
    }
    const name = lang === "en" ? r.serviceNameEn || r.serviceNameAr : r.serviceNameAr;
    const s = services.get(r.serviceId) ?? { name, bookings: 0, revenue: 0 };
    s.bookings += 1;
    if (r.status === "COMPLETED") s.revenue += r.totalPrice;
    services.set(r.serviceId, s);

    const hour = parseInt(r.startTime.split(":")[0], 10);
    if (Number.isFinite(hour)) {
      const k = `${r.date.getUTCDay()}-${hour}`;
      heat.set(k, (heat.get(k) ?? 0) + 1);
    }
  }

  const months = MONTHS[lang];
  const revenueByPeriod = [...periods.entries()].map(([key, v]) => {
    const [, m, d] = key.split("-").map(Number);
    const label = granularity === "month" ? months[m - 1] : lang === "en" ? `${months[m - 1]} ${d}` : `${d} ${months[m - 1]}`;
    return { period: label, revenue: v.revenue, bookings: v.bookings };
  });

  return {
    kpis: {
      totalBookings: counted.length,
      completedRevenue,
      avgBookingValue: completed.length > 0 ? completedRevenue / completed.length : null,
      repeatCustomerRate: customers.size > 0 ? repeatCount / customers.size : null,
      currency,
      mixedCurrency: currencies.size > 1,
    },
    revenueByPeriod,
    bookingsByService: [...services.values()]
      .sort((a, b) => b.bookings - a.bookings || a.name.localeCompare(b.name))
      .map((s, i) => ({ serviceName: s.name, bookings: s.bookings, revenue: s.revenue, color: SERVICE_COLORS[i % SERVICE_COLORS.length] })),
    heatmap: [...heat.entries()].map(([k, count]) => {
      const [day, hour] = k.split("-").map(Number);
      return { day, hour, count };
    }),
    granularity,
  };
}

/** Reads the range from the database and computes the page. */
export async function loadAnalytics(
  businessId: string,
  fromStr: string,
  toStr: string,
  lang: "ar" | "en",
): Promise<AnalyticsPayload> {
  const from = parseDay(fromStr);
  const to = parseDay(toStr);
  const rows = await db.booking.findMany({
    where: {
      businessId,
      isTest: false,
      date: { gte: from, lte: to },
      status: { notIn: [...EXCLUDED_STATUSES] },
    },
    select: {
      date: true,
      startTime: true,
      status: true,
      totalPrice: true,
      currency: true,
      customerId: true,
      serviceId: true,
      service: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const customerIds = [...new Set(rows.map((r) => r.customerId).filter((c): c is string => !!c))];
  const repeaters = new Set<string>();
  if (customerIds.length > 0) {
    const counts = await db.booking.groupBy({
      by: ["customerId"],
      where: { businessId, isTest: false, status: "COMPLETED", customerId: { in: customerIds } },
      _count: { id: true },
    });
    for (const c of counts) if (c.customerId && (c._count.id ?? 0) > 1) repeaters.add(c.customerId);
  }

  return computeAnalytics(
    rows.map((r) => ({
      date: r.date,
      startTime: r.startTime,
      status: r.status,
      totalPrice: Number(r.totalPrice),
      currency: r.currency,
      customerId: r.customerId,
      serviceId: r.serviceId,
      serviceNameAr: r.service.nameAr,
      serviceNameEn: r.service.nameEn,
    })),
    { from, to },
    repeaters,
    lang,
  );
}
