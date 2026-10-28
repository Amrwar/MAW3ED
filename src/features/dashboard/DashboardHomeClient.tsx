"use client";

import Link from "@/components/shared/LocaleLink";
import {
  ExternalLink, Store, Clock, CheckCircle2,
  AlertTriangle, ChevronLeft, TrendingUp, ArrowLeft,
} from "lucide-react";
import KpiGrid, { type Kpis } from "@/features/dashboard/KpiGrid";
import RecentBookings, { type RecentBooking } from "@/features/dashboard/RecentBookings";
import QuickActions from "@/features/dashboard/QuickActions";
import NewBookingButton from "@/features/dashboard/NewBookingButton";
import DashboardTodayWidget from "@/features/dashboard/DashboardTodayWidget";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { dateLong, num, money, clock, duration as fmtDuration } from "@/lib/fmt";

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
  kpis:                Kpis;
  recentBookings:      RecentBooking[];
  todayBookings:       DashboardBooking[];
  openDaysCount:       number;
  isOpenToday:         boolean | TodayHours | null | undefined;
  todayHours:          TodayHours | null | undefined;
  isProfileIncomplete: boolean;
  /** Bookings counted against a capped plan this month; null when uncapped. */
  allowance: { used: number; limit: number } | null;
}

/** A single snapshot figure. Hoisted so it is not rebuilt per render. */
function InfoCard({
  icon: Icon,
  value,
  label,
  sub,
  tone = "neutral",
}: {
  icon:  React.ElementType;
  value: React.ReactNode;
  label: string;
  sub?:  React.ReactNode;
  tone?: "neutral" | "jade" | "muted";
}) {
  const iconCls =
    tone === "jade"
      ? "bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
      : tone === "muted"
        ? "bg-[var(--color-surface-3)] text-[var(--color-subtle)]"
        : "bg-[var(--color-surface-3)] text-[var(--color-muted)]";

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${iconCls}`}
      >
        <Icon size={18} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[1.5rem] font-bold leading-none tracking-tight text-[var(--color-ink)]">
          {value}
        </p>
        <p className="m-0 mt-1.5 text-[0.84375rem] text-[var(--color-muted)]">{label}</p>
        {sub && <div className="mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardHomeClient({
  businessNameAr,
  slug,
  services,
  kpis,
  recentBookings,
  todayBookings,
  openDaysCount,
  isOpenToday,
  todayHours,
  isProfileIncomplete,
  allowance,
}: Props) {
  const { t, lang } = useLanguage();
  const h = t.dashboard.home;

  const openStatus = !!isOpenToday;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Greeting ── */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]">
            {h.welcome}، {businessNameAr}
          </h1>
          <p className="m-0 mt-2 text-[0.84375rem] text-[var(--color-subtle)]">
            {dateLong(new Date(), lang)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={`/company/${slug}`}
            target="_blank"
            className="btn btn-outline btn-sm"
          >
            <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />
            {h.viewPage}
          </Link>
          <NewBookingButton
            slug={slug}
            services={services}
            className="btn btn-primary"
            label={h.newBooking}
          />
        </div>
      </div>

      {/* ── Setup prompt ── */}
      {/* At 80% of a capped plan, before customers start being turned
          away rather than after. */}
      {allowance && allowance.used >= Math.ceil(allowance.limit * 0.8) && (
        <div
          role="status"
          className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] px-5 py-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle size={18} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-warn)]" />
            <div className="min-w-0">
              <p className="m-0 text-[0.875rem] font-bold text-[var(--color-warn)]">
                {allowance.used >= allowance.limit
                  ? lang === "en"
                    ? "You've reached this month's booking limit"
                    : "وصلت لحد الحجوزات الشهري"
                  : lang === "en"
                    ? `${num(allowance.used, lang)} of ${num(allowance.limit, lang)} bookings used this month`
                    : `استخدمت ${num(allowance.used, lang)} من ${num(allowance.limit, lang)} حجز الشهر ده`}
              </p>
              <p className="m-0 mt-1 text-[0.78125rem] leading-relaxed text-[var(--color-warn)]/85">
                {allowance.used >= allowance.limit
                  ? lang === "en"
                    ? "Customers can't book online until next month. Upgrade to keep taking bookings."
                    : "العملاء مش هيقدروا يحجزوا أونلاين لحد الشهر الجاي. رقّي باقتك عشان تفضل تستقبل حجوزات."
                  : lang === "en"
                    ? "When the limit is reached, customers can't book online until next month."
                    : "لما توصل للحد، العملاء مش هيقدروا يحجزوا أونلاين لحد الشهر الجاي."}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/billing"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-warn)] px-3.5 py-2 text-[0.75rem] font-bold text-white"
          >
            {lang === "en" ? "Upgrade" : "رقّي الباقة"}
            <ChevronLeft size={13} aria-hidden="true" className={lang === "en" ? "rotate-180" : undefined} />
          </Link>
        </div>
      )}

      {isProfileIncomplete && (
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--color-warn)]"
            />
            <div className="min-w-0">
              <p className="m-0 text-[0.875rem] font-bold text-[var(--color-warn)]">
                {h.completeProfileTitle}
              </p>
              <p className="m-0 mt-1 text-[0.78125rem] leading-relaxed text-[var(--color-warn)]/85">
                {h.completeProfileSub}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/settings"
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--color-warn)] px-3.5 py-2 text-[0.75rem] font-bold text-white"
          >
            {h.completeNow}
            <ChevronLeft size={13} aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* ── Snapshot ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          icon={Store}
          tone="jade"
          value={<span className="num">{num(services.length, lang)}</span>}
          label={h.publishedServices}
        />
        <InfoCard
          icon={Clock}
          value={<span className="num">{num(openDaysCount, lang)}</span>}
          label={h.workingDays}
        />
        <InfoCard
          icon={CheckCircle2}
          tone={openStatus ? "jade" : "muted"}
          value={
            <span className={openStatus ? "text-[1.125rem] text-[var(--color-ok)]" : "text-[1.125rem] text-[var(--color-subtle)]"}>
              {openStatus ? h.openToday : h.closedToday}
            </span>
          }
          label={openStatus ? "مفتوح حاليًا" : "مغلق حاليًا"}
          sub={
            openStatus && todayHours ? (
              <p className="num m-0 text-xs text-[var(--color-subtle)]">
                {clock(todayHours.openTime)} — {clock(todayHours.closeTime)}
              </p>
            ) : null
          }
        />
      </div>

      {/* ── KPIs ── */}
      <KpiGrid kpis={kpis} />

      {/* ── Today + side column ── */}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-6">
          <DashboardTodayWidget
            initialBookings={todayBookings}
            slug={slug}
            services={services}
          />
          <RecentBookings bookings={recentBookings} />
        </div>

        <div className="flex flex-[0_1_19rem] min-w-[16rem] flex-col gap-5">
          <QuickActions slug={slug} />

          {services.length > 0 && (
            <section className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
                <h2 className="m-0 flex items-center gap-2 text-[0.9375rem] font-bold text-[var(--color-ink)]">
                  <TrendingUp size={16} strokeWidth={1.8} className="text-[var(--color-jade)]" aria-hidden="true" />
                  {h.yourServices}
                </h2>
                <Link
                  href="/dashboard/services"
                  className="flex shrink-0 items-center gap-1 text-[0.75rem] font-bold text-[var(--color-jade)]"
                >
                  {h.manageServices}
                  <ArrowLeft size={12} aria-hidden="true" />
                </Link>
              </div>

              <ul className="flex flex-col">
                {services.slice(0, 5).map((svc) => (
                  <li
                    key={svc.id}
                    className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3.5 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[0.875rem] font-bold text-[var(--color-ink)]">
                        {svc.nameAr}
                      </p>
                      <p className="m-0 mt-1 text-xs text-[var(--color-subtle)]">
                        {fmtDuration(svc.duration, lang)}
                      </p>
                    </div>
                    <span className="num shrink-0 text-[0.875rem] font-bold text-[var(--color-ink)]">
                      {money(svc.price, lang, svc.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
