"use client";

import { TrendingUp, TrendingDown, Calendar, Users, Clock, Banknote } from "lucide-react";
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

function pctChange(curr: number, prev: number, lang: string) {
  if (prev === 0 && curr === 0) return { label: "٠٪", up: true };
  if (prev === 0)               return { label: "+١٠٠٪", up: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return {
    label: `${pct >= 0 ? "+" : ""}${Math.abs(pct)}%`,
    up:    pct >= 0,
  };
}

const CARD_ACCENTS = [
  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",   // blue  — bookings
  "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",   // amber — pending
  "linear-gradient(135deg, #059669 0%, #34D399 100%)",   // green — customers
  "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",   // purple — revenue
];
const CARD_ICON_BG = ["#EFF6FF", "#FFFBEB", "#F0FDF4", "#F5F3FF"];
const CARD_ICON_COLOR = ["#1D4ED8", "#B45309", "#059669", "#7C3AED"];

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  const { t, lang } = useLanguage();
  const sc     = t.dashboard.statsCards;
  const locale = lang === "ar" ? "ar-EG" : "en-US";

  const bookingChange = pctChange(stats.bookingsThisMonth, stats.bookingsLastMonth, lang);
  const revenueChange = pctChange(stats.revenueThisMonth,  stats.revenueLastMonth,  lang);

  const cards = [
    {
      label:  sc.bookingsThisMonth,
      value:  stats.bookingsThisMonth.toLocaleString(locale),
      change: bookingChange.label,
      up:     bookingChange.up,
      period: sc.vsLastMonth,
      Icon:   Calendar,
    },
    {
      label:  sc.pendingBookings,
      value:  stats.pendingBookings.toLocaleString(locale),
      change: null as string | null,
      up:     false,
      period: sc.pendingWaiting,
      Icon:   Clock,
    },
    {
      label:  sc.totalCustomers,
      value:  stats.totalCustomers.toLocaleString(locale),
      change: stats.newCustomers > 0
        ? `+${stats.newCustomers.toLocaleString(locale)} ${sc.thisMonth}`
        : null,
      up:     true,
      period: sc.registeredCustomers,
      Icon:   Users,
    },
    {
      label:  sc.monthlyRevenue,
      value:  `${stats.revenueThisMonth.toLocaleString(locale)} ${stats.currency}`,
      change: revenueChange.label,
      up:     revenueChange.up,
      period: sc.vsLastMonth,
      Icon:   Banknote,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const { Icon } = card;
        return (
          <div
            key={card.label}
            className="rounded-2xl border bg-white overflow-hidden"
            style={{
              borderColor: "#E2E8F0",
              boxShadow:   "0 1px 8px rgba(15,23,42,0.05)",
            }}
          >
            {/* Top accent stripe */}
            <div className="h-1" style={{ background: CARD_ACCENTS[i] }} />

            <div className="p-5">
              {/* Icon + trend row */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: CARD_ICON_BG[i] }}
                >
                  <Icon size={19} style={{ color: CARD_ICON_COLOR[i] }} strokeWidth={1.75} />
                </div>

                {card.change && (
                  <div
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{
                      background: card.up ? "#DCFCE7" : "#FEE2E2",
                      color:      card.up ? "#15803D" : "#DC2626",
                    }}
                  >
                    {card.up
                      ? <TrendingUp size={11} strokeWidth={2.5} />
                      : <TrendingDown size={11} strokeWidth={2.5} />}
                    {card.change}
                  </div>
                )}

                {/* Pending indicator dot */}
                {i === 1 && stats.pendingBookings > 0 && (
                  <span
                    className="w-2.5 h-2.5 rounded-full animate-pulse"
                    style={{ background: "#F59E0B", marginTop: 4 }}
                  />
                )}
              </div>

              {/* Value */}
              <p
                className="font-black text-[#0F172A] mb-1 leading-none"
                style={{ fontSize: 28, letterSpacing: "-0.02em" }}
              >
                {card.value}
              </p>

              {/* Label */}
              <p className="text-sm font-semibold text-[#0F172A] mb-0.5">{card.label}</p>

              {/* Period / helper text */}
              <p className="text-xs text-[#94A3B8]">{card.period}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
