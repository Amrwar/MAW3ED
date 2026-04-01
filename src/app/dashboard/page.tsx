import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ExternalLink, Store, Clock } from "lucide-react";
import StatsCards, { type DashboardStats } from "@/features/dashboard/StatsCards";
import RecentBookings, { type RecentBooking } from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import NewBookingButton from "@/features/dashboard/NewBookingButton";
import DashboardTodayWidget from "@/features/dashboard/DashboardTodayWidget";
import Button from "@/components/ui/Button";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";

export const metadata: Metadata = { title: "لوحة التحكم | موعد" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const business = await db.business.findUnique({
    where:   { id: session.user.businessId },
    include: {
      services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
      availability: { orderBy: { dayOfWeek: "asc" } },
      category:     true,
      city:         true,
      _count:       { select: { bookings: true, customers: true } },
    },
  });

  if (!business) redirect("/onboarding");

  // Date range helpers
  const now              = new Date();
  const startThisMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startLastMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const todayStart       = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd         = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const businessId       = session.user.businessId;

  // Fetch the 20 most recent bookings + real stats + today's schedule in parallel
  const [
    rawBookings,
    bookingsThisMonth,
    bookingsLastMonth,
    totalCustomers,
    newCustomers,
    pendingBookings,
    revenueThisMonth,
    revenueLastMonth,
    rawTodayBookings,
  ] = await Promise.all([
    db.booking.findMany({
      where:   { businessId },
      include: { service: { select: { nameAr: true } } },
      orderBy: { date: "desc" },
      take:    20,
    }),
    db.booking.count({
      where: { businessId, createdAt: { gte: startThisMonth } },
    }),
    db.booking.count({
      where: { businessId, createdAt: { gte: startLastMonth, lt: startThisMonth } },
    }),
    db.customer.count({ where: { businessId } }),
    db.customer.count({ where: { businessId, createdAt: { gte: startThisMonth } } }),
    db.booking.count({ where: { businessId, status: "PENDING" } }),
    db.booking.aggregate({
      where: { businessId, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: startThisMonth } },
      _sum:  { totalPrice: true },
    }),
    db.booking.aggregate({
      where: { businessId, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: startLastMonth, lt: startThisMonth } },
      _sum:  { totalPrice: true },
    }),
    db.booking.findMany({
      where: {
        businessId,
        date:   { gte: todayStart, lt: todayEnd },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: { service: { select: { nameAr: true, duration: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const stats: DashboardStats = {
    bookingsThisMonth,
    bookingsLastMonth,
    totalCustomers,
    newCustomers,
    pendingBookings,
    revenueThisMonth: Number(revenueThisMonth._sum.totalPrice ?? 0),
    revenueLastMonth: Number(revenueLastMonth._sum.totalPrice ?? 0),
    currency: business.services[0]?.currency ?? "EGP",
  };

  const recentBookings: RecentBooking[] = rawBookings.map((b) => ({
    id:            b.id,
    customerName:  b.customerName,
    customerPhone: b.customerPhone,
    serviceName:   b.service.nameAr,
    date:          b.date,
    startTime:     b.startTime,
    status:        b.status as RecentBooking["status"],
    totalPrice:    Number(b.totalPrice),
    currency:      b.currency,
  }));

  const todayBookings: DashboardBooking[] = rawTodayBookings.map((b) => ({
    id:              b.id,
    customerName:    b.customerName,
    customerPhone:   b.customerPhone,
    serviceName:     b.service.nameAr,
    serviceDuration: b.service.duration,
    date:            b.date.toISOString().slice(0, 10),
    startTime:       b.startTime,
    endTime:         b.endTime ?? null,
    status:          b.status as DashboardBooking["status"],
    totalPrice:      Number(b.totalPrice),
    currency:        b.currency,
    notes:           b.notes ?? null,
    customerNotes:   null,
    createdAt:       b.createdAt.toISOString(),
  }));

  const widgetServices = business.services.map((s) => ({
    id:       s.id,
    nameAr:   s.nameAr,
    duration: s.duration,
    price:    Number(s.price),
    currency: s.currency,
  }));

  const today = new Date().toLocaleDateString("ar-EG", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  const todayDayOfWeek = new Date().getDay(); // 0=Sunday
  const todayHours = business.availability.find(
    (a) => a.dayOfWeek === todayDayOfWeek
  );
  const isOpenToday = todayHours && !todayHours.isClosed;

  const openDaysCount = business.availability.filter((a) => !a.isClosed).length;
  const isProfileIncomplete = !business.about || !business.address;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
            أهلًا، {business.nameAr} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/company/${business.slug}`}
            target="_blank"
            className="btn btn-outline btn-sm gap-1.5 text-sm"
          >
            <ExternalLink size={14} />
            عرض صفحتك
          </Link>
          <NewBookingButton
            slug={business.slug}
            services={business.services.map((s) => ({
              id:       s.id,
              nameAr:   s.nameAr,
              duration: s.duration,
              price:    Number(s.price),
              currency: s.currency,
            }))}
            className="btn btn-primary btn-sm gap-1.5"
            label="حجز جديد"
          />
        </div>
      </div>

      {/* Incomplete profile nudge */}
      {isProfileIncomplete && (
        <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-accent)] mb-0.5">
              اكمل إعداد صفحتك ⚡
            </p>
            <p className="text-xs text-[var(--color-accent)]/70">
              أضف وصف عملك وعنوانك لتظهر بشكل أفضل في نتائج البحث.
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="accent" size="sm">
              اكمل الآن
            </Button>
          </Link>
        </div>
      )}

      {/* Quick profile overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Services count */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Store size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-[var(--color-text-primary)]">
              {business.services.length}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">خدمة منشورة</p>
          </div>
        </div>

        {/* Working days */}
        <div className="card p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-black text-[var(--color-text-primary)]">
              {openDaysCount}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              أيام عمل أسبوعيًا
            </p>
          </div>
        </div>

        {/* Today status */}
        <div className="card p-5 flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOpenToday ? "bg-green-50" : "bg-gray-50"
            }`}
          >
            <span
              className={`w-3 h-3 rounded-full ${
                isOpenToday ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>
          <div>
            <p className={`text-base font-bold ${isOpenToday ? "text-green-600" : "text-gray-500"}`}>
              {isOpenToday ? "مفتوح اليوم" : "إجازة اليوم"}
            </p>
            {isOpenToday && todayHours && (
              <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
                {todayHours.openTime} – {todayHours.closeTime}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Real stats */}
      <StatsCards stats={stats} />

      {/* Today's schedule */}
      <DashboardTodayWidget
        initialBookings={todayBookings}
        slug={business.slug}
        services={widgetServices}
      />

      {/* Services quick list */}
      {business.services.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="font-bold text-[var(--color-text-primary)]">خدماتك</h3>
            <Link href="/dashboard/services">
              <Button variant="ghost" size="sm">
                إدارة الخدمات
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {business.services.slice(0, 5).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {service.nameAr}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {service.duration} دقيقة
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--color-accent)]">
                  {Number(service.price).toLocaleString("ar-EG")} ج
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent bookings + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentBookings bookings={recentBookings} />
        </div>
        <div>
          <QuickActions slug={business.slug} />
        </div>
      </div>
    </div>
  );
}
