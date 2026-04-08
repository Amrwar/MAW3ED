"use client";

import Link from "next/link";
import { ExternalLink, Store, Clock } from "lucide-react";
import StatsCards, { type DashboardStats } from "@/features/dashboard/StatsCards";
import RecentBookings, { type RecentBooking } from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import NewBookingButton from "@/features/dashboard/NewBookingButton";
import DashboardTodayWidget from "@/features/dashboard/DashboardTodayWidget";
import Button from "@/components/ui/Button";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface ServicePreview {
  id:       string;
  nameAr:   string;
  duration: number;
  price:    number;
  currency: string;
}

interface TodayHours {
  openTime:  string;
  closeTime: string;
  isClosed:  boolean;
}

interface DashboardHomeClientProps {
  businessNameAr:      string;
  slug:                string;
  services:            ServicePreview[];
  stats:               DashboardStats;
  recentBookings:      RecentBooking[];
  todayBookings:       DashboardBooking[];
  openDaysCount:       number;
  isOpenToday:         boolean | TodayHours | null | undefined;
  todayHours:          TodayHours | null | undefined;
  isProfileIncomplete: boolean;
}

export default function DashboardHomeClient({
  businessNameAr,
  slug,
  services,
  stats,
  recentBookings,
  todayBookings,
  openDaysCount,
  isOpenToday,
  todayHours,
  isProfileIncomplete,
}: DashboardHomeClientProps) {
  const { t, lang } = useLanguage();
  const h           = t.dashboard.home;
  const locale      = lang === "ar" ? "ar-EG" : "en-US";

  const todayStr = new Date().toLocaleDateString(locale, {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
            {h.welcome} {businessNameAr} 👋
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/company/${slug}`}
            target="_blank"
            className="btn btn-outline btn-sm gap-1.5 text-sm"
          >
            <ExternalLink size={14} />
            {h.viewPage}
          </Link>
          <NewBookingButton
            slug={slug}
            services={services}
            className="btn btn-primary btn-sm gap-1.5"
            label={h.newBooking}
          />
        </div>
      </div>

      {/* Incomplete profile nudge */}
      {isProfileIncomplete && (
        <div className="bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[var(--color-accent)] mb-0.5">
              {h.completeProfileTitle}
            </p>
            <p className="text-xs text-[var(--color-accent)]/70">
              {h.completeProfileSub}
            </p>
          </div>
          <Link href="/dashboard/settings">
            <Button variant="accent" size="sm">
              {h.completeNow}
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
              {services.length}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)]">{h.publishedServices}</p>
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
              {h.workingDays}
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
              {isOpenToday ? h.openToday : h.closedToday}
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
        slug={slug}
        services={services}
      />

      {/* Services quick list */}
      {services.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="font-bold text-[var(--color-text-primary)]">{h.yourServices}</h3>
            <Link href="/dashboard/services">
              <Button variant="ghost" size="sm">
                {h.manageServices}
              </Button>
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {services.slice(0, 5).map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {service.nameAr}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {service.duration} {h.minutes}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--color-accent)]">
                  {service.price.toLocaleString(locale)} {service.currency}
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
          <QuickActions slug={slug} />
        </div>
      </div>
    </div>
  );
}
