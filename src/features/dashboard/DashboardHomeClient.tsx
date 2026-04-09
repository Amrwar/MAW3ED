"use client";

import Link from "next/link";
import {
  ExternalLink, Store, Clock, CheckCircle2,
  AlertTriangle, ChevronLeft, TrendingUp, ArrowLeft,
} from "lucide-react";
import StatsCards, { type DashboardStats } from "@/features/dashboard/StatsCards";
import RecentBookings, { type RecentBooking } from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import NewBookingButton from "@/features/dashboard/NewBookingButton";
import DashboardTodayWidget from "@/features/dashboard/DashboardTodayWidget";
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

interface Props {
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

// Gradient icon boxes consistent with brand
function InfoCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
}: {
  icon:       React.ElementType;
  iconBg:     string;
  iconColor:  string;
  value:      React.ReactNode;
  label:      string;
  sub?:       React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-5 flex items-center gap-4"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg }}
      >
        <Icon size={18} strokeWidth={1.75} style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <p
          className="font-black text-[#0F172A] leading-none mb-1"
          style={{ fontSize: 24, letterSpacing: "-0.02em" }}
        >
          {value}
        </p>
        <p className="text-sm text-[#475569] font-medium">{label}</p>
        {sub && <div className="mt-0.5">{sub}</div>}
      </div>
    </div>
  );
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
}: Props) {
  const { t, lang } = useLanguage();
  const h           = t.dashboard.home;
  const locale      = lang === "ar" ? "ar-EG" : "en-US";

  const todayStr = new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    year:    "numeric",
    month:   "long",
    day:     "numeric",
  });

  const openStatus = !!isOpenToday;

  return (
    <div className="space-y-6">

      {/* ── Top header ── */}
      <div
        className="rounded-2xl border bg-white px-6 py-5"
        style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest mb-1">
              {todayStr}
            </p>
            <h1
              className="font-black text-[#0F172A] leading-tight"
              style={{ fontSize: 22, letterSpacing: "-0.02em" }}
            >
              {h.welcome}،{" "}
              <span style={{ color: "#1D4ED8" }}>{businessNameAr}</span>{" "}
              👋
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/company/${slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
              style={{
                background:  "#F8FAFC",
                border:      "1px solid #E2E8F0",
                color:       "#475569",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "#BFDBFE";
                el.style.color = "#1D4ED8";
                el.style.background = "#EFF6FF";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.borderColor = "#E2E8F0";
                el.style.color = "#475569";
                el.style.background = "#F8FAFC";
              }}
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              {h.viewPage}
            </Link>
            <NewBookingButton
              slug={slug}
              services={services}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
              }}
              label={h.newBooking}
            />
          </div>
        </div>
      </div>

      {/* ── Profile incomplete alert ── */}
      {isProfileIncomplete && (
        <div
          className="rounded-2xl px-5 py-4 flex items-start justify-between gap-4"
          style={{
            background:  "rgba(234,179,8,0.07)",
            border:      "1px solid rgba(234,179,8,0.25)",
          }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-0.5">{h.completeProfileTitle}</p>
              <p className="text-xs text-amber-700">{h.completeProfileSub}</p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap px-3 py-1.5 rounded-lg shrink-0 transition-colors"
            style={{ background: "rgba(234,179,8,0.15)", color: "#92400E" }}
          >
            {h.completeNow}
            <ChevronLeft size={12} />
          </Link>
        </div>
      )}

      {/* ── Business snapshot cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InfoCard
          icon={Store}
          iconBg="#EFF6FF"
          iconColor="#1D4ED8"
          value={services.length}
          label={h.publishedServices}
        />
        <InfoCard
          icon={Clock}
          iconBg="#F0FDF4"
          iconColor="#059669"
          value={openDaysCount}
          label={h.workingDays}
        />
        <InfoCard
          icon={CheckCircle2}
          iconBg={openStatus ? "#F0FDF4" : "#F8FAFC"}
          iconColor={openStatus ? "#22C55E" : "#94A3B8"}
          value={
            <span style={{ color: openStatus ? "#22C55E" : "#94A3B8", fontSize: 18 }}>
              {openStatus ? h.openToday : h.closedToday}
            </span>
          }
          label={openStatus ? "مفتوح حاليًا" : "مغلق حاليًا"}
          sub={
            openStatus && todayHours ? (
              <p className="text-xs text-[#94A3B8]" dir="ltr">
                {todayHours.openTime} – {todayHours.closeTime}
              </p>
            ) : null
          }
        />
      </div>

      {/* ── KPI stats ── */}
      <StatsCards stats={stats} />

      {/* ── Main two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px] gap-6 items-start">

        {/* Left: today + recent bookings */}
        <div className="space-y-6 min-w-0">
          <DashboardTodayWidget
            initialBookings={todayBookings}
            slug={slug}
            services={services}
          />
          <RecentBookings bookings={recentBookings} />
        </div>

        {/* Right sidebar: quick actions + services */}
        <div className="space-y-5">
          <QuickActions slug={slug} />

          {/* Services performance card */}
          {services.length > 0 && (
            <div
              className="rounded-2xl border bg-white overflow-hidden"
              style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 8px rgba(15,23,42,0.05)" }}
            >
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid #F1F5F9" }}
              >
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} strokeWidth={1.75} style={{ color: "#3B82F6" }} />
                  <h3 className="text-sm font-bold text-[#0F172A]">{h.yourServices}</h3>
                </div>
                <Link
                  href="/dashboard/services"
                  className="inline-flex items-center gap-1 text-xs font-semibold transition-colors"
                  style={{ color: "#3B82F6" }}
                >
                  {h.manageServices}
                  <ArrowLeft size={11} />
                </Link>
              </div>

              <div className="p-3">
                {services.slice(0, 5).map((svc, i) => (
                  <div
                    key={svc.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "#F8FAFC";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Rank number */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                        style={{
                          background: i === 0 ? "#FEF3C7" : "#F1F5F9",
                          color:      i === 0 ? "#92400E" : "#64748B",
                        }}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{svc.nameAr}</p>
                        <p className="text-xs text-[#94A3B8]">{svc.duration} {h.minutes}</p>
                      </div>
                    </div>
                    <span
                      className="text-sm font-bold shrink-0 ms-3"
                      style={{ color: "#1D4ED8" }}
                    >
                      {svc.price.toLocaleString(locale)}
                      <span className="text-xs font-medium text-[#94A3B8] ms-1">{svc.currency}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
