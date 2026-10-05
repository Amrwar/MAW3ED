"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

/**
 * The middle plan is the one we recommend, so it is the only card
 * that gets a filled dark surface. The other two stay quiet.
 */
export default function PricingPreview() {
  const { t } = useLanguage();
  const p = t.pricingPreview;

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">

        <div className="mb-10 flex flex-col items-center text-center">
          <span className="section-eyebrow">{p.eyebrow}</span>
          <h2 className="section-title mt-2.5">{p.title}</h2>
          <p className="section-subtitle mx-auto mt-4">{p.subtitle}</p>
        </div>

        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {p.plans.map((plan, i) => {
            const featured = i === 1;
            return (
              <article
                key={plan.name}
                className={cn(
                  "flex flex-col rounded-[var(--radius-xl)] p-8",
                  featured
                    ? "relative bg-[var(--color-night)] shadow-[var(--shadow-modal)]"
                    : "border border-[var(--color-line)] bg-[var(--color-surface)]",
                )}
              >
                {featured && (
                  <span className="absolute end-6 top-6 rounded-full bg-[var(--color-jade)] px-3 py-1.5 text-[0.71875rem] font-bold text-white">
                    {p.badge}
                  </span>
                )}

                <h3 className={cn("text-[1.1875rem] font-bold", featured ? "text-white" : "text-[var(--color-ink)]")}>
                  {plan.name}
                </h3>

                <div
                  className={cn(
                    "mt-6 flex items-baseline gap-2 border-b pb-6",
                    featured ? "border-[var(--color-night-line)]" : "border-[var(--color-line)]",
                  )}
                >
                  <span
                    className={cn(
                      "num text-[2.875rem] font-light leading-none tracking-tight",
                      featured ? "text-white" : "text-[var(--color-ink)]",
                    )}
                  >
                    {plan.price}
                  </span>
                  <span className={cn("text-sm", featured ? "text-[var(--color-night-subtle)]" : "text-[var(--color-subtle)]")}>
                    {plan.period}
                  </span>
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-3.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={cn(
                        "flex items-start gap-3 text-sm leading-relaxed",
                        featured ? "text-[var(--color-night-text)]" : "text-[var(--color-ink-2)]",
                      )}
                    >
                      <Check
                        size={17}
                        strokeWidth={2.2}
                        aria-hidden="true"
                        className={cn("mt-0.5 shrink-0", featured ? "text-[#4FA98B]" : "text-[var(--color-jade)]")}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup?type=business"
                  className={cn(
                    "btn mt-7 w-full",
                    featured
                      ? "bg-white font-extrabold text-[var(--color-ink)] hover:bg-white/90"
                      : "btn-outline",
                  )}
                >
                  {plan.cta}
                </Link>
              </article>
            );
          })}
        </div>

        <div className="mt-9 text-center">
          <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-jade)]">
            {p.viewAll}
          </Link>
        </div>
      </div>
    </section>
  );
}
