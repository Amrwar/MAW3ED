"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  Search, CalendarDays, CheckCircle2,
  Store, Share2, TrendingUp,
} from "lucide-react";

const CUSTOMER_ICONS = [Search, CalendarDays, CheckCircle2];
const BUSINESS_ICONS = [Store, Share2, TrendingUp];

/**
 * The numerals here are a real sequence — three ordered steps — so
 * the editorial 01/02/03 treatment is carrying information rather
 * than decorating the section.
 */
export default function HowItWorks() {
  const { t } = useLanguage();
  const h = t.howItWorks;
  const [tab, setTab] = useState<"customer" | "business">("customer");

  const steps = tab === "customer" ? h.customerSteps : h.businessSteps;
  const icons = tab === "customer" ? CUSTOMER_ICONS : BUSINESS_ICONS;

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-7 py-12 sm:px-12 sm:py-14">

          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <span className="section-eyebrow">{h.eyebrow}</span>
              <h2 className="section-title mt-2.5">{h.title}</h2>
              <p className="section-subtitle mt-4">{h.subtitle}</p>
            </div>

            <div
              role="tablist"
              aria-label={h.eyebrow}
              className="flex shrink-0 gap-1 rounded-full bg-[var(--color-surface-3)] p-1"
            >
              {([
                ["customer", h.forCustomers],
                ["business", h.forBusinesses],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "h-10 rounded-full px-5 text-[0.84375rem] transition-colors",
                    tab === key
                      ? "bg-[var(--color-surface)] font-bold text-[var(--color-ink)] shadow-[0_1px_2px_rgb(17_32_28/0.08)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = icons[i];
              return (
                <li key={step.title} className="flex flex-col gap-3.5">
                  <span
                    aria-hidden="true"
                    className="font-display num text-[3.25rem] font-light italic leading-none text-[var(--color-jade)]"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true" className="h-px w-11 bg-[var(--color-line-2)]" />
                  <h3 className="mt-1.5 flex items-center gap-2.5 text-[1.25rem] font-bold text-[var(--color-ink)]">
                    <Icon size={19} strokeWidth={1.8} className="text-[var(--color-jade)]" aria-hidden="true" />
                    {step.title}
                  </h3>
                  <p className="text-[0.90625rem] leading-[1.8] text-[var(--color-muted)]">
                    {step.description}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
