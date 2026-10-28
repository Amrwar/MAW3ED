"use client";

import { BadgeCheck, CalendarCheck, MessageCircle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import type { PlatformReach } from "@/lib/data";

interface Props {
  /** Null while there are too few listings for a count to help (SHOW_COUNTS_FROM). */
  reach: PlatformReach | null;
}

/**
 * What a visitor gets, not how many people got it before them.
 *
 * The section this replaces advertised "300+ businesses", "12,000+
 * bookings" and "98% satisfaction" against five listings, four
 * bookings and no reviews table — the figures were written into the
 * translation file by hand. Everything here is either a promise the
 * product actually keeps or a number counted out of the database.
 */
export default function TrustSignals({ reach }: Props) {
  const { t, lang } = useLanguage();
  const ts = t.trustSignals;

  const promises = [
    { Icon: BadgeCheck,    title: ts.verifiedTitle,  body: ts.verifiedBody },
    { Icon: CalendarCheck, title: ts.instantTitle,   body: ts.instantBody },
    { Icon: ShieldCheck,   title: ts.noFeesTitle,    body: ts.noFeesBody },
    { Icon: MessageCircle, title: ts.arabicTitle,    body: ts.arabicBody },
  ];

  /**
   * Counted, never written down. A figure that is still zero says
   * nothing worth saying, so it is left out rather than shown as "0".
   */
  const figures = reach
    ? [
        { value: reach.businesses, label: ts.countBusinesses },
        { value: reach.cities,     label: ts.countCities },
        { value: reach.categories, label: ts.countCategories },
      ].filter((f) => f.value > 0)
    : [];

  return (
    <section className="mt-20 border-y border-[var(--color-line)] bg-[var(--color-surface)] py-16">
      <div className="container-app">

        <div className="mb-12 max-w-[46rem]">
          <span className="section-eyebrow">{ts.eyebrow}</span>
          <h2 className="section-title mt-2.5">{ts.title}</h2>
        </div>

        <ul className="grid list-none grid-cols-1 gap-x-8 gap-y-9 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {promises.map(({ Icon, title, body }) => (
            <li key={title} className="min-w-0">
              <span
                aria-hidden="true"
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
              >
                <Icon size={19} strokeWidth={1.8} />
              </span>
              <h3 className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">{title}</h3>
              <p className="m-0 mt-2 text-[0.84375rem] leading-[1.7] text-[var(--color-subtle)]">
                {body}
              </p>
            </li>
          ))}
        </ul>

        {figures.length > 0 && (
          <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-5 border-t border-[var(--color-line)] pt-8">
            {figures.map((f) => (
              <p key={f.label} className="m-0 flex items-baseline gap-2">
                <span className="num text-[1.375rem] font-bold leading-none text-[var(--color-ink)]">
                  {num(f.value, lang)}
                </span>
                <span className="text-[0.84375rem] text-[var(--color-subtle)]">{f.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
