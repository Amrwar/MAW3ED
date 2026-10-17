"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { money, num } from "@/lib/fmt";
import { Figures, Rows } from "../_components/ReportBits";

/**
 * How often appointments actually happen.
 *
 * The rates are drawn only from appointments that have reached their
 * time — a booking next Tuesday is neither kept nor missed yet, and
 * counting it as "not completed" would make a full diary look like a
 * failing one.
 */
export default function PerformanceView({
  completionRate,
  cancellationRate,
  noShowRate,
  sampleSize,
  byStaff,
  byService,
}: {
  completionRate: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  sampleSize: number;
  byStaff: { id: string; name: string; nameEn?: string | null; completed: number; noShows: number; revenue: number }[];
  byService: { name: string; nameEn?: string | null; completed: number; cancelled: number }[];
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const pct = (v: number | null) =>
    v === null ? "—" : `${num(Math.round(v * 100), lang)}%`;

  return (
    <div className="space-y-5">
      <Figures
        items={[
          {
            label: ar ? "مواعيد تمّت" : "Completion rate",
            value: pct(completionRate),
            hint: ar
              ? `من ${num(sampleSize, lang)} موعد عدّى وقته`
              : `of ${num(sampleSize, lang)} settled`,
          },
          { label: ar ? "إلغاء" : "Cancellation rate", value: pct(cancellationRate) },
          { label: ar ? "غياب" : "No-show rate", value: pct(noShowRate) },
          {
            label: ar ? "مواعيد محسوبة" : "Counted",
            value: num(sampleSize, lang),
            hint: ar ? "اللي عدّى وقته بس" : "settled only",
          },
        ]}
      />

      <Rows
        title={ar ? "الفريق" : "By staff member"}
        head={[
          ar ? "الاسم" : "Name",
          ar ? "تمّت" : "Completed",
          ar ? "غياب" : "No-shows",
          ar ? "إيراد" : "Revenue",
        ]}
        rows={byStaff.map((s) => [
          !ar && s.nameEn ? s.nameEn : s.name,
          num(s.completed, lang),
          num(s.noShows, lang),
          money(s.revenue, lang),
        ])}
        empty={
          ar
            ? "مفيش مواعيد متسجّلة على حد من الفريق في المدة دي"
            : "No appointments assigned to a staff member in this period"
        }
      />

      <Rows
        title={ar ? "الخدمات" : "By service"}
        head={[ar ? "الخدمة" : "Service", ar ? "تمّت" : "Completed", ar ? "اتلغت" : "Cancelled"]}
        rows={byService.map((s) => [!ar && s.nameEn ? s.nameEn : s.name, num(s.completed, lang), num(s.cancelled, lang)])}
        empty={ar ? "لسه مفيش" : "Nothing yet"}
      />
    </div>
  );
}
