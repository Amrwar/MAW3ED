"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { money, num } from "@/lib/fmt";
import { Figures, Rows } from "../_components/ReportBits";

/** Who comes, and who comes back. */
export default function CustomersView({
  totalCustomers,
  newInPeriod,
  returningInPeriod,
  repeatCustomers,
  averageVisits,
  top,
  days,
}: {
  totalCustomers: number;
  newInPeriod: number;
  returningInPeriod: number;
  repeatCustomers: number;
  averageVisits: number | null;
  top: { id: string; name: string; visits: number; spend: number }[];
  days: number;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const period = ar ? `آخر ${num(days, lang)} يوم` : `last ${num(days, lang)} days`;

  return (
    <div className="space-y-5">
      <Figures
        items={[
          { label: ar ? "كل العملاء" : "All customers", value: num(totalCustomers, lang) },
          { label: ar ? "عملاء جدد" : "New", value: num(newInPeriod, lang), hint: period },
          {
            label: ar ? "عملاء رجعوا" : "Returning",
            value: num(returningInPeriod, lang),
            hint: period,
          },
          {
            label: ar ? "بيزوروا أكتر من مرة" : "Visited more than once",
            value: num(repeatCustomers, lang),
            hint:
              averageVisits !== null
                ? ar
                  ? `متوسط ${num(Math.round(averageVisits * 10) / 10, lang)} زيارة`
                  : `${num(Math.round(averageVisits * 10) / 10, lang)} visits on average`
                : undefined,
          },
        ]}
      />

      <Rows
        title={ar ? "أكتر العملاء إنفاقًا" : "Highest spending customers"}
        head={[
          ar ? "العميل" : "Customer",
          ar ? "زيارات" : "Visits",
          ar ? "أنفق" : "Spent",
        ]}
        rows={top.map((c) => [c.name, num(c.visits, lang), money(c.spend, lang)])}
        empty={
          ar
            ? "لسه مفيش مواعيد تمّت"
            : "No completed appointments yet"
        }
      />

      <p className="m-0 text-center text-[0.75rem] text-[var(--color-subtle)]">
        <Link href="/dashboard/customers" className="font-bold text-[var(--color-jade)]">
          {ar ? "افتح كل العملاء" : "Open all customers"}
        </Link>
      </p>
    </div>
  );
}
