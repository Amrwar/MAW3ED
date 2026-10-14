import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

export type RevenuePoint = { period: string; revenue: number; bookings: number };
export type ServiceSlice  = { serviceName: string; bookings: number; revenue: number; color: string };
export type HeatCell      = { day: number; hour: number; count: number };

export type AnalyticsPayload = {
  kpis: {
    totalBookings:      number;
    completedRevenue:   number;
    avgBookingValue:    number;
    repeatCustomerRate: number;
    currency:           string;
  };
  revenueByPeriod:    RevenuePoint[];
  bookingsByService:  ServiceSlice[];
  heatmap:            HeatCell[];
  granularity:        "day" | "week" | "month";
};

const SERVICE_COLORS = [
  "#6366f1","#f59e0b","var(--color-ok)","#ef4444","#3b82f6",
  "var(--color-jade)","var(--color-jade)","var(--color-info)","var(--color-warn)","var(--color-ok)",
];

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

/**
 * GET /api/business/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns all analytics data for the given date range.
 * Revenue = COMPLETED bookings only.
 * Heatmap + service breakdown = all non-CANCELLED bookings.
 */
export async function GET(req: Request) {
  try {
    const { business } = await requireBusiness();
    const { searchParams } = new URL(req.url);

    const fromStr = searchParams.get("from");
    const toStr   = searchParams.get("to");

    if (!fromStr || !toStr) return err("حدد بداية ونهاية الفترة", 400);

    const [fy, fm, fd] = fromStr.split("-").map(Number);
    const [ty, tm, td] = toStr.split("-").map(Number);
    const fromDate = new Date(Date.UTC(fy, fm - 1, fd));
    const toDate   = new Date(Date.UTC(ty, tm - 1, td, 23, 59, 59));

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return err("تاريخ غير صحيح", 400);

    // ── Fetch bookings in range ──────────────────────────────
    const bookings = await db.booking.findMany({
      where: {
        businessId: business.id,
        date:       { gte: fromDate, lte: toDate },
        status:     { not: "CANCELLED" },
      },
      select: {
        id:          true,
        date:        true,
        startTime:   true,
        status:      true,
        totalPrice:  true,
        currency:    true,
        customerId:  true,
        serviceId:   true,
        service:     { select: { nameAr: true } },
      },
      orderBy: { date: "asc" },
    });

    const currency = bookings[0]?.currency ?? "EGP";

    // ── KPIs ────────────────────────────────────────────────
    const completed = bookings.filter((b) => b.status === "COMPLETED");
    const completedRevenue = completed.reduce((s, b) => s + Number(b.totalPrice), 0);
    const totalBookings    = bookings.length;
    const avgBookingValue  = completed.length > 0 ? completedRevenue / completed.length : 0;

    // Repeat customer rate: customers in range who have >1 booking across all time
    const customerIdsInRange = [...new Set(bookings.map((b) => b.customerId).filter(Boolean))] as string[];
    let repeatCount = 0;
    if (customerIdsInRange.length > 0) {
      const counts = await db.booking.groupBy({
        by:     ["customerId"],
        where:  { businessId: business.id, customerId: { in: customerIdsInRange }, status: { not: "CANCELLED" } },
        _count: { id: true },
      });
      repeatCount = counts.filter((c) => (c._count.id ?? 0) > 1).length;
    }
    const repeatCustomerRate = customerIdsInRange.length > 0
      ? repeatCount / customerIdsInRange.length
      : 0;

    // ── Granularity ─────────────────────────────────────────
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86_400_000);
    const granularity: "day" | "week" | "month" =
      daysDiff <= 31 ? "day" : daysDiff <= 90 ? "week" : "month";

    // ── Revenue by period ────────────────────────────────────
    const revenueMap = new Map<string, { revenue: number; bookings: number }>();

    // Pre-fill all periods in range so gaps show as zero
    if (granularity === "day") {
      for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = d.toISOString().split("T")[0];
        revenueMap.set(key, { revenue: 0, bookings: 0 });
      }
    } else if (granularity === "week") {
      for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 7)) {
        const key = d.toISOString().split("T")[0];
        revenueMap.set(key, { revenue: 0, bookings: 0 });
      }
    } else {
      for (let d = new Date(Date.UTC(fy, fm - 1, 1)); d <= toDate; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        revenueMap.set(key, { revenue: 0, bookings: 0 });
      }
    }

    for (const b of bookings) {
      let key: string;
      if (granularity === "day") {
        key = b.date.toISOString().split("T")[0];
      } else if (granularity === "week") {
        // Round down to Monday of the booking's week
        const d = new Date(b.date);
        const dow = d.getUTCDay(); // 0=Sun
        d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7)); // shift to Monday
        // Find closest pre-fill key
        key = d.toISOString().split("T")[0];
        if (!revenueMap.has(key)) {
          // find the closest week start that was pre-filled
          const keys = [...revenueMap.keys()];
          key = keys.reduce((prev, cur) => (cur <= b.date.toISOString().split("T")[0] ? cur : prev));
        }
      } else {
        key = `${b.date.getUTCFullYear()}-${String(b.date.getUTCMonth() + 1).padStart(2, "0")}`;
      }

      const entry = revenueMap.get(key);
      if (entry) {
        entry.bookings += 1;
        if (b.status === "COMPLETED") entry.revenue += Number(b.totalPrice);
      }
    }

    const revenueByPeriod: RevenuePoint[] = [...revenueMap.entries()].map(([key, val]) => {
      let label: string;
      if (granularity === "day") {
        const [, m, d] = key.split("-").map(Number);
        label = `${d} ${AR_MONTHS[m - 1]}`;
      } else if (granularity === "week") {
        const [, m, d] = key.split("-").map(Number);
        label = `${d} ${AR_MONTHS[m - 1]}`;
      } else {
        const [, m] = key.split("-").map(Number);
        label = AR_MONTHS[m - 1];
      }
      return { period: label, revenue: val.revenue, bookings: val.bookings };
    });

    // ── Bookings by service ──────────────────────────────────
    const serviceMap = new Map<string, { name: string; bookings: number; revenue: number }>();
    for (const b of bookings) {
      const name = b.service.nameAr;
      const entry = serviceMap.get(b.serviceId) ?? { name, bookings: 0, revenue: 0 };
      entry.bookings += 1;
      if (b.status === "COMPLETED") entry.revenue += Number(b.totalPrice);
      serviceMap.set(b.serviceId, entry);
    }
    const bookingsByService: ServiceSlice[] = [...serviceMap.values()]
      .sort((a, b) => b.bookings - a.bookings)
      .map((s, i) => ({
        serviceName: s.name,
        bookings:    s.bookings,
        revenue:     s.revenue,
        color:       SERVICE_COLORS[i % SERVICE_COLORS.length],
      }));

    // ── Heatmap ──────────────────────────────────────────────
    const heatMap = new Map<string, number>();
    for (const b of bookings) {
      const day  = b.date.getUTCDay(); // 0=Sun
      const hour = parseInt(b.startTime.split(":")[0], 10);
      const key  = `${day}-${hour}`;
      heatMap.set(key, (heatMap.get(key) ?? 0) + 1);
    }
    const heatmap: HeatCell[] = [...heatMap.entries()].map(([key, count]) => {
      const [day, hour] = key.split("-").map(Number);
      return { day, hour, count };
    });

    return ok({
      kpis:              { totalBookings, completedRevenue, avgBookingValue, repeatCustomerRate, currency },
      revenueByPeriod,
      bookingsByService,
      heatmap,
      granularity,
    } satisfies AnalyticsPayload);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[analytics GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
