"use client";

import { Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import type { AnalyticsPayload } from "@/lib/dashboard/analytics";
import { useLanguage } from "@/contexts/LanguageContext";

const TEXT = {
  ar: {
    bookings: "الحجوزات",
    bookingsSub: "من غير الملغية والدفع اللي ما كملش",
    value: "قيمة الحجوزات المكتملة",
    valueSub: "سعر الخدمات اللي اتعملت، مش المبالغ المحصّلة",
    avg: "متوسط قيمة الحجز المكتمل",
    repeat: "العملاء المتكررين",
    repeatSub: "عملاء ليهم أكتر من حجز مكتمل",
    none: "—",
    noneSub: "مفيش بيانات كفاية في الفترة دي",
    mixed: "الفترة فيها أكتر من عملة، فالمجموع تقريبي",
  },
  en: {
    bookings: "Bookings",
    bookingsSub: "Excluding cancelled and unfinished checkouts",
    value: "Completed booking value",
    valueSub: "Price of work done, not money collected",
    avg: "Average completed booking",
    repeat: "Repeat customers",
    repeatSub: "Customers with more than one completed booking",
    none: "—",
    noneSub: "Not enough data in this period",
    mixed: "This period has more than one currency; totals are approximate",
  },
};

export default function KPICards({ kpis }: { kpis: AnalyticsPayload["kpis"] }) {
  const { lang } = useLanguage();
  const t = TEXT[lang === "en" ? "en" : "ar"];
  const locale = lang === "en" ? "en-US" : "ar-EG-u-nu-latn";
  const n = (v: number) => Math.round(v).toLocaleString(locale);

  const cards = [
    {
      label: t.bookings,
      value: n(kpis.totalBookings),
      sub: t.bookingsSub,
      icon: Calendar,
      bg: "bg-[var(--color-jade-soft)]",
      iconCls: "text-[var(--color-jade)]",
    },
    {
      label: t.value,
      value: n(kpis.completedRevenue),
      sub: `${kpis.currency} · ${t.valueSub}`,
      icon: DollarSign,
      bg: "bg-[var(--color-ok-soft)]",
      iconCls: "text-[var(--color-ok)]",
    },
    {
      label: t.avg,
      value: kpis.avgBookingValue === null ? t.none : n(kpis.avgBookingValue),
      sub: kpis.avgBookingValue === null ? t.noneSub : kpis.currency,
      icon: TrendingUp,
      bg: "bg-[var(--color-jade-soft)]",
      iconCls: "text-[var(--color-jade)]",
    },
    {
      label: t.repeat,
      value: kpis.repeatCustomerRate === null ? t.none : `${n(kpis.repeatCustomerRate * 100)}%`,
      sub: kpis.repeatCustomerRate === null ? t.noneSub : t.repeatSub,
      icon: Users,
      bg: "bg-[var(--color-warn-soft)]",
      iconCls: "text-[var(--color-star)]",
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card p-5">
              <div className={`w-10 h-10 rounded-[var(--radius-md)] ${c.bg} flex items-center justify-center mb-4`}>
                <Icon size={18} className={c.iconCls} aria-hidden />
              </div>
              <p className="text-2xl font-extrabold text-[var(--color-text-primary)] leading-none">{c.value}</p>
              <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">{c.label}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>
      {kpis.mixedCurrency && <p className="text-xs text-[var(--color-warn)]">{t.mixed}</p>}
    </div>
  );
}
