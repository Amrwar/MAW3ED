"use client";

import { TrendingUp, TrendingDown, Calendar, Users, Clock, Banknote } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num, money } from "@/lib/fmt";
import { cn } from "@/lib/utils";

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

function pctChange(curr: number, prev: number) {
  if (prev === 0 && curr === 0) return { label: "0%", up: true };
  if (prev === 0) return { label: "+100%", up: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { label: `${pct >= 0 ? "+" : "-"}${Math.abs(pct)}%`, up: pct >= 0 };
}

export default function StatsCards({ stats }: { stats: DashboardStats }) {
  const { t, lang } = useLanguage();
  const sc = t.dashboard.statsCards;

  const bookingChange = pctChange(stats.bookingsThisMonth, stats.bookingsLastMonth);
  const revenueChange = pctChange(stats.revenueThisMonth, stats.revenueLastMonth);

  const cards = [
    {
      label:  sc.bookingsThisMonth,
      value:  num(stats.bookingsThisMonth, lang),
      change: bookingChange.label,
      up:     bookingChange.up,
      period: sc.vsLastMonth,
      Icon:   Calendar,
      /** Pending is the only card that needs attention, so it is the
       *  only one that carries a status tone. */
      attention: false,
    },
    {
      label:  sc.pendingBookings,
      value:  num(stats.pendingBookings, lang),
      change: null as string | null,
      up:     false,
      period: sc.pendingWaiting,
      Icon:   Clock,
      attention: stats.pendingBookings > 0,
    },
    {
      label:  sc.totalCustomers,
      value:  num(stats.totalCustomers, lang),
      change:
        stats.newCustomers > 0
          ? `+${num(stats.newCustomers, lang)} ${sc.thisMonth}`
          : null,
      up:     true,
      period: sc.registeredCustomers,
      Icon:   Users,
      attention: false,
    },
    {
      label:  sc.monthlyRevenue,
      value:  money(stats.revenueThisMonth, lang, stats.currency),
      change: revenueChange.label,
      up:     revenueChange.up,
      period: sc.vsLastMonth,
      Icon:   Banknote,
      attention: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const { Icon } = card;
        return (
          <div
            key={card.label}
            className={cn(
              "rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5",
              card.attention
                ? "border-[var(--color-warn-line)]"
                : "border-[var(--color-line)]",
            )}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
                  card.attention
                    ? "bg-[var(--color-warn-soft)] text-[var(--color-warn)]"
                    : "bg-[var(--color-surface-3)] text-[var(--color-muted)]",
                )}
              >
                <Icon size={19} strokeWidth={1.8} />
              </span>

              {card.change && (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.71875rem] font-bold",
                    card.up
                      ? "bg-[var(--color-ok-soft)] text-[var(--color-ok)]"
                      : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
                  )}
                >
                  {card.up ? (
                    <TrendingUp size={11} strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <TrendingDown size={11} strokeWidth={2.5} aria-hidden="true" />
                  )}
                  <span className="num">{card.change}</span>
                </span>
              )}
            </div>

            <p className="num m-0 text-[1.75rem] font-bold leading-none tracking-tight text-[var(--color-ink)]">
              {card.value}
            </p>
            <p className="m-0 mt-2 text-[0.875rem] font-bold text-[var(--color-ink)]">{card.label}</p>
            <p className="m-0 mt-1 text-xs text-[var(--color-subtle)]">{card.period}</p>
          </div>
        );
      })}
    </div>
  );
}
