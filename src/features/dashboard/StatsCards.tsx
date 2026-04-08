"use client";

import { TrendingUp, TrendingDown, Calendar, Users, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type DashboardStats = {
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalCustomers:    number;
  newCustomers:      number;
  pendingBookings:   number;
  revenueThisMonth:  number;
  revenueLastMonth:  number;
  currency:          string;
};

function pctChange(curr: number, prev: number, lang: string): { label: string; up: boolean } {
  if (prev === 0 && curr === 0) return { label: lang === "ar" ? "٠٪" : "0%", up: true };
  if (prev === 0)               return { label: "+100%", up: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return {
    label: `${pct >= 0 ? "+" : ""}${Math.abs(pct).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}%`,
    up:    pct >= 0,
  };
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  const { t, lang } = useLanguage();
  const sc = t.dashboard.statsCards;

  const bookingChange = pctChange(stats.bookingsThisMonth, stats.bookingsLastMonth, lang);
  const revenueChange = pctChange(stats.revenueThisMonth,  stats.revenueLastMonth,  lang);
  const locale        = lang === "ar" ? "ar-EG" : "en-US";

  const cards = [
    {
      label:  sc.bookingsThisMonth,
      value:  stats.bookingsThisMonth.toLocaleString(locale),
      change: bookingChange.label,
      up:     bookingChange.up,
      period: sc.vsLastMonth,
      icon:   Calendar,
      color:  "blue",
    },
    {
      label:  sc.pendingBookings,
      value:  stats.pendingBookings.toLocaleString(locale),
      change: null,
      up:     true,
      period: sc.pendingWaiting,
      icon:   Clock,
      color:  stats.pendingBookings > 0 ? "amber" : "green",
    },
    {
      label:  sc.totalCustomers,
      value:  stats.totalCustomers.toLocaleString(locale),
      change: stats.newCustomers > 0
        ? `+${stats.newCustomers.toLocaleString(locale)} ${sc.thisMonth}`
        : null,
      up:     true,
      period: sc.registeredCustomers,
      icon:   Users,
      color:  "green",
    },
    {
      label:  sc.monthlyRevenue,
      value:  stats.revenueThisMonth.toLocaleString(locale),
      change: revenueChange.label,
      up:     revenueChange.up,
      period: sc.vsLastMonth,
      icon:   DollarSign,
      color:  "purple",
      suffix: stats.currency,
    },
  ];

  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue:  { bg: "bg-blue-50",  icon: "text-blue-500"  },
    green: { bg: "bg-green-50", icon: "text-green-500" },
    amber: { bg: "bg-amber-50", icon: "text-amber-500" },
    purple:{ bg: "bg-purple-50",icon: "text-purple-500"},
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((stat) => {
        const colors = colorMap[stat.color];
        const Icon   = stat.icon;

        return (
          <div key={stat.label} className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
                <Icon size={18} className={colors.icon} />
              </div>
              {stat.change && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                    stat.up ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500",
                  )}
                >
                  {stat.up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {stat.change}
                </div>
              )}
            </div>

            <p className="text-2xl font-black text-[var(--color-text-primary)] mb-0.5">
              {stat.value}
              {stat.suffix && (
                <span className="text-sm font-medium text-[var(--color-text-muted)] ms-1">
                  {stat.suffix}
                </span>
              )}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{stat.label}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.period}</p>
          </div>
        );
      })}
    </div>
  );
}
