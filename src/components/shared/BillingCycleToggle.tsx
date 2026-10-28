"use client";

import { cn } from "@/lib/utils";
import { ANNUAL_MONTHS_CHARGED, type BillingCycle } from "@/lib/plans";
import type { Lang } from "@/lib/i18n";

/**
 * Monthly or a year up front. One control for the pricing page and the
 * owner's subscription panel, so the two say the same thing.
 */
export default function BillingCycleToggle({
  value,
  onChange,
  lang,
  className,
}: {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  lang: Lang;
  className?: string;
}) {
  const en = lang === "en";
  const free = 12 - ANNUAL_MONTHS_CHARGED;
  return (
    <div
      role="radiogroup"
      aria-label={en ? "Billing period" : "مدة الاشتراك"}
      className={cn("flex w-fit gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] p-1", className)}
    >
      {(["monthly", "annual"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={cn(
            "min-h-10 rounded-full px-5 text-sm font-bold transition-colors",
            value === c ? "bg-[var(--color-jade)] text-white" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
          )}
        >
          {c === "monthly"
            ? en ? "Monthly" : "شهري"
            : en ? `Yearly · ${free} months free` : `سنوي · ${free === 2 ? "شهرين" : `${free} شهور`} ببلاش`}
        </button>
      ))}
    </div>
  );
}
