"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { arCount, enCount, num } from "@/lib/fmt";
import { Bars, Figures } from "../_components/ReportBits";

const DAYS = { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" };

/** How many appointments, when, and for what. */
export default function BookingsView({
  total,
  completed,
  cancelled,
  noShows,
  byDay,
  byService,
  byHour,
  days,
}: {
  total: number;
  completed: number;
  cancelled: number;
  noShows: number;
  byDay: { day: string; count: number }[];
  byService: { name: string; nameEn?: string | null; count: number }[];
  byHour: { hour: number; count: number }[];
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
            label: ar ? "كل الحجوزات" : "All bookings",
            value: num(total, lang),
            hint: ar ? `آخر ${arCount(days, DAYS)}` : `last ${enCount(days, "day")}`,
          },
          { label: ar ? "تمّت" : "Completed", value: num(completed, lang) },
          { label: ar ? "اتلغت" : "Cancelled", value: num(cancelled, lang) },
          { label: ar ? "غياب" : "No-shows", value: num(noShows, lang) },
        ]}
      />

      <Bars
        title={ar ? "الحجوزات باليوم" : "Bookings by day"}
        rows={byDay.map((d) => ({ label: dayLabel(d.day), value: d.count }))}
        empty={ar ? "مفيش حجوزات في المدة دي" : "No bookings in this period"}
      />

      <Bars
        title={ar ? "أكتر الأوقات حجزًا" : "Busiest hours"}
        rows={byHour.map((h) => ({
          label: `${String(h.hour).padStart(2, "0")}:00`,
          value: h.count,
        }))}
        empty={ar ? "لسه مفيش" : "Nothing yet"}
      />

      <Bars
        title={ar ? "الحجوزات بالخدمة" : "Bookings by service"}
        rows={byService.map((s) => ({ label: !ar && s.nameEn ? s.nameEn : s.name, value: s.count }))}
        empty={ar ? "لسه مفيش" : "Nothing yet"}
      />
    </div>
  );
}
