"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/reports/revenue", ar: "الإيرادات", en: "Revenue" },
  { href: "/dashboard/reports/bookings", ar: "الحجوزات", en: "Bookings" },
  { href: "/dashboard/reports/customers", ar: "العملاء", en: "Customers" },
  { href: "/dashboard/reports/performance", ar: "الأداء", en: "Performance" },
];

const PERIODS = [7, 30, 90, 365];

/**
 * The frame every report shares: which report, over how long.
 *
 * The period is in the URL so a report can be linked to, and so
 * switching between reports keeps the window you were looking at.
 */
export default function ReportShell({
  children,
  sampleSize,
}: {
  children: React.ReactNode;
  /** Shown as a caution when there is too little to read much into. */
  sampleSize?: number;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const days = Number(params.get("days") ?? 30);

  function setDays(d: number) {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(d));
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          {ar ? "التقارير" : "Reports"}
        </h1>

        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={`${tab.href}?days=${days}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "min-h-11 shrink-0 rounded-full px-4 text-[0.8125rem] leading-[2.75rem] transition-colors",
                  active
                    ? "bg-[var(--color-jade)] font-bold text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                )}
              >
                {ar ? tab.ar : tab.en}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.75rem] text-[var(--color-subtle)]">
            {ar ? "المدة" : "Period"}
          </span>
          {PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={cn(
                "min-h-9 rounded-full border px-3 text-[0.78125rem] transition-colors",
                days === d
                  ? "border-[var(--color-jade)] bg-[var(--color-jade-tint)] font-bold text-[var(--color-jade)]"
                  : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]",
              )}
            >
              {d === 365
                ? ar
                  ? "سنة"
                  : "1 year"
                : ar
                  ? `${num(d, lang)} يوم`
                  : `${num(d, lang)} days`}
            </button>
          ))}
        </div>
      </header>

      {sampleSize !== undefined && sampleSize > 0 && sampleSize < 10 && (
        <p className="m-0 rounded-[var(--radius-md)] border border-[var(--color-warn-line)] bg-[var(--color-warn-soft)] px-4 py-3 text-[0.78125rem] leading-relaxed text-[var(--color-ink-2)]">
          {ar
            ? `النسب دي محسوبة من ${num(sampleSize, lang)} موعد بس — رقم صغير، فاقرأها على إنها مؤشر مش حكم.`
            : `These rates come from just ${num(sampleSize, lang)} appointments — too few to read much into yet.`}
        </p>
      )}

      {children}
    </div>
  );
}
