import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { translations, type Lang } from "@/lib/i18n";
import AnalyticsClient from "./_components/AnalyticsClient";
import type { AnalyticsPayload, RevenuePoint, ServiceSlice, HeatCell } from "@/app/api/business/analytics/route";
import { getEffectivePlan, canUseFeature, type Plan, type SubscriptionStatus } from "@/lib/plans";

export const metadata: Metadata = { title: "الإحصائيات" };

const SERVICE_COLORS = [
  "var(--color-jade)","var(--color-star)","var(--color-ok)","var(--color-danger)","var(--color-jade)",
  "var(--color-jade)","var(--color-jade)","var(--color-info)","var(--color-warn)","var(--color-ok)",
];

const AR_MONTHS = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const lang = ((await cookies()).get("maw3ed-lang")?.value ?? "ar") as Lang;
  const an   = translations[lang].dashboard.analytics;

  const businessId = session.user.businessId;

  // ── Plan gate: analytics requires GROWTH+ ────────────────────────────────
  const bizPlan = await db.business.findUnique({
    where:  { id: businessId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (bizPlan) {
    const effectivePlan = getEffectivePlan(
      bizPlan.plan as Plan,
      bizPlan.subscriptionStatus as SubscriptionStatus,
      bizPlan.trialEndsAt,
    );
    if (!canUseFeature(effectivePlan, "analytics")) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-[var(--radius-lg)] bg-[var(--color-jade-soft)] flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
            {an.upsell.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm leading-relaxed">
            {an.upsell.sub.split(an.upsell.growth)[0]}
            <strong className="text-[var(--color-jade)]">{an.upsell.growth}</strong>
            {an.upsell.sub.split(an.upsell.growth)[1]?.split(an.upsell.pro)[0]}
            <strong className="text-[var(--color-warn)]">{an.upsell.pro}</strong>
            {an.upsell.sub.split(an.upsell.pro)[1]}
          </p>
          <Link
            href="/pricing"
            className="px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {an.upsell.cta}
          </Link>
        </div>
      );
    }
  }

  // Default range: this month
  const now        = new Date();
  const fromDate   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const toDate     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));

  const bookings = await db.booking.findMany({
    where: {
      businessId,
      date:   { gte: fromDate, lte: toDate },
      status: { not: "CANCELLED" },
    },
    select: {
      id:         true,
      date:       true,
      startTime:  true,
      status:     true,
      totalPrice: true,
      currency:   true,
      customerId: true,
      serviceId:  true,
      service:    { select: { nameAr: true } },
    },
    orderBy: { date: "asc" },
  });

  const currency = bookings[0]?.currency ?? "EGP";

  // KPIs
  const completed        = bookings.filter((b) => b.status === "COMPLETED");
  const completedRevenue = completed.reduce((s, b) => s + Number(b.totalPrice), 0);
  const avgBookingValue  = completed.length > 0 ? completedRevenue / completed.length : 0;

  const customerIds = [...new Set(bookings.map((b) => b.customerId).filter(Boolean))] as string[];
  let repeatCount   = 0;
  if (customerIds.length > 0) {
    const counts = await db.booking.groupBy({
      by:     ["customerId"],
      where:  { businessId, customerId: { in: customerIds }, status: { not: "CANCELLED" } },
      _count: { id: true },
    });
    repeatCount = counts.filter((c) => (c._count.id ?? 0) > 1).length;
  }
  const repeatCustomerRate = customerIds.length > 0 ? repeatCount / customerIds.length : 0;

  // Revenue by day (this month = day granularity)
  const revenueMap = new Map<string, { revenue: number; bookings: number }>();
  for (let d = new Date(fromDate); d <= toDate; d.setUTCDate(d.getUTCDate() + 1)) {
    revenueMap.set(d.toISOString().split("T")[0], { revenue: 0, bookings: 0 });
  }
  for (const b of bookings) {
    const key   = b.date.toISOString().split("T")[0];
    const entry = revenueMap.get(key);
    if (entry) {
      entry.bookings += 1;
      if (b.status === "COMPLETED") entry.revenue += Number(b.totalPrice);
    }
  }
  const revenueByPeriod: RevenuePoint[] = [...revenueMap.entries()].map(([key, val]) => {
    const [, m, d] = key.split("-").map(Number);
    return { period: `${d} ${AR_MONTHS[m - 1]}`, revenue: val.revenue, bookings: val.bookings };
  });

  // Service breakdown
  const serviceMap = new Map<string, { name: string; bookings: number; revenue: number }>();
  for (const b of bookings) {
    const entry = serviceMap.get(b.serviceId) ?? { name: b.service.nameAr, bookings: 0, revenue: 0 };
    entry.bookings += 1;
    if (b.status === "COMPLETED") entry.revenue += Number(b.totalPrice);
    serviceMap.set(b.serviceId, entry);
  }
  const bookingsByService: ServiceSlice[] = [...serviceMap.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .map((s, i) => ({ serviceName: s.name, bookings: s.bookings, revenue: s.revenue, color: SERVICE_COLORS[i % SERVICE_COLORS.length] }));

  // Heatmap
  const heatMap = new Map<string, number>();
  for (const b of bookings) {
    const day  = b.date.getUTCDay();
    const hour = parseInt(b.startTime.split(":")[0], 10);
    const key  = `${day}-${hour}`;
    heatMap.set(key, (heatMap.get(key) ?? 0) + 1);
  }
  const heatmap: HeatCell[] = [...heatMap.entries()].map(([key, count]) => {
    const [day, hour] = key.split("-").map(Number);
    return { day, hour, count };
  });

  const initial: AnalyticsPayload = {
    kpis: { totalBookings: bookings.length, completedRevenue, avgBookingValue, repeatCustomerRate, currency },
    revenueByPeriod,
    bookingsByService,
    heatmap,
    granularity: "day",
  };

  return <AnalyticsClient initial={initial} />;
}
