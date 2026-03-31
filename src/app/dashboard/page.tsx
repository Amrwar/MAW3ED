import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CalendarDays, ExternalLink, Store, Clock, Users } from "lucide-react";
import StatsCards from "@/features/dashboard/StatsCards";
import RecentBookings, { type RecentBooking } from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import Button from "@/components/ui/Button";

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

  // Fetch the 20 most recent bookings for this business
  const rawBookings = await db.booking.findMany({
    where:   { businessId: session.user.businessId },
    include: { service: { select: { nameAr: true } } },
    orderBy: { date: "desc" },
    take:    20,
  });

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
          <Button variant="primary" size="sm" className="gap-1.5">
            <CalendarDays size={14} />
            حجز جديد
          </Button>
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

      {/* Stats (placeholder — real booking stats in step 3) */}
      <StatsCards />

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
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
