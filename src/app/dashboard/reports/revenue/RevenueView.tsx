"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, enCount, money, num } from "@/lib/fmt";
import { Bars, Figures } from "../_components/ReportBits";

const DAYS = { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" };
const APPT = { one: "ميعاد واحد", two: "ميعادين", few: "مواعيد", many: "ميعاد" };

/**
 * Money that came in.
 *
 * Only completed appointments count. A confirmed booking for next week
 * is not revenue — it is a booking — and the page says so rather than
 * flattering the total.
 */
export default function RevenueView({
  total,
  completedCount,
  average,
  byDay,
  byService,
  days,
}: {
  total: number;
  completedCount: number;
  average: number | null;
  byDay: { day: string; amount: number }[];
  byService: { name: string; nameEn?: string | null; amount: number; count: number }[];
  days: number;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(ar ? "ar-EG-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
    }).format(new Date(iso));

  return (
    <div className="space-y-5">
      <Figures
        items={[
          {
            label: ar ? "الإجمالي" : "Total",
            value: total > 0 ? money(total, lang) : "—",
            hint: ar ? "من المواعيد اللي تمّت" : "completed appointments only",
          },
          {
            label: ar ? "مواعيد تمّت" : "Completed",
            value: num(completedCount, lang),
            hint: ar ? `آخر ${arCount(days, DAYS)}` : `last ${enCount(days, "day")}`,
          },
          {
            label: ar ? "متوسط الموعد" : "Average appointment",
            value: average !== null ? money(Math.round(average), lang) : "—",
          },
          {
            label: ar ? "أيام فيها دخل" : "Days with income",
            value: num(byDay.length, lang),
          },
        ]}
      />

      <Bars
        title={ar ? "الإيراد باليوم" : "Revenue by day"}
        kind="money"
        rows={byDay.map((d) => ({ label: dayLabel(d.day), value: d.amount }))}
        empty={ar ? "مفيش مواعيد تمّت في المدة دي" : "No completed appointments in this period"}
      />

      <Bars
        title={ar ? "الإيراد بالخدمة" : "Revenue by service"}
        kind="money"
        rows={byService.map((s) => ({
          label: lang === "en" && s.nameEn ? s.nameEn : s.name,
          value: s.amount,
          sub: ar ? arCount(s.count, APPT) : enCount(s.count, "appointment"),
        }))}
        empty={ar ? "لسه مفيش" : "Nothing yet"}
      />
    </div>
  );
}
