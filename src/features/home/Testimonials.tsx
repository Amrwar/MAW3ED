"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { testimonials } from "@/data/testimonials";
import Avatar from "@/components/ui/Avatar";

/**
 * Reads from `src/data/testimonials.ts` rather than a second copy
 * hardcoded in this file, so there is one place to edit a quote.
 */
export default function Testimonials() {
  const { t, lang } = useLanguage();
  const tm = t.testimonials;
  const isAr = lang === "ar";

  const shown = testimonials.slice(0, 3);

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">

        <div className="mb-10 flex flex-col items-center text-center">
          <span className="section-eyebrow">{tm.eyebrow}</span>
          <h2 className="section-title mt-2.5">{tm.title}</h2>
          <p className="section-subtitle mx-auto mt-4">{tm.subtitle}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {shown.map((r) => {
            const text = isAr ? r.text : r.textEn;
            const role = isAr ? r.authorRole : r.authorRoleEn;

            return (
              <figure
                key={r.id}
                className="m-0 flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-7"
              >
                <div
                  className="mb-4 flex gap-0.5"
                  role="img"
                  aria-label={isAr ? `${r.rating} من 5` : `${r.rating} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={14}
                      aria-hidden="true"
                      className={
                        n <= r.rating
                          ? "fill-[var(--color-star)] text-[var(--color-star)]"
                          : "fill-[var(--color-line)] text-[var(--color-line)]"
                      }
                    />
                  ))}
                </div>

                <blockquote className="m-0 flex-1 text-[0.96875rem] leading-[1.85] text-[var(--color-ink-2)]">
                  {text}
                </blockquote>

                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar name={r.authorName} size="md" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--color-ink)]">
                      {r.authorName}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--color-subtle)]">
                      {role}
                      {r.businessName ? ` · ${r.businessName}` : ""}
                    </span>
                  </span>
                  <span className="badge badge-default ms-auto shrink-0">
                    {r.type === "business" ? tm.badgeBusiness : tm.badgeCustomer}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
