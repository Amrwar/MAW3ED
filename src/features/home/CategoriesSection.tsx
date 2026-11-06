"use client";

import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { coverClassFor } from "@/lib/category-cover";
import { upcomingCategories } from "@/lib/category-upcoming";
import { countText } from "@/lib/i18n";
import type { CategoryWithCount } from "@/lib/data";

interface Props {
  categories: CategoryWithCount[];
  /** How many live categories get a card before "View all" takes over. */
  limit?: number;
}

/** Coming-soon chips under the cards, at most. */
const UPCOMING_CHIPS = 6;

/**
 * Browse by what you need done (design option E, chosen 2026-11-06).
 *
 * The hero's mint carries on into this section, with two soft green
 * glows behind the cards, so the top of the page reads as one piece.
 * Categories people can book get a large card with the category's
 * photo (the same .cover-* class as on /categories and on business
 * cards); the kinds of place still to come are a row of small grey
 * chips, which says "more is coming" without filling the page with
 * greyed-out tiles.
 *
 * Counts come from the database. This section used to carry a table
 * of invented ones — "240+ providers" for medical, "320+ salons" for
 * beauty — keyed by slug, with a rotating list of plausible numbers
 * for any slug that table missed.
 */
export default function CategoriesSection({ categories, limit = 6 }: Props) {
  const { t, lang } = useLanguage();
  const c = t.categories;
  const isAr = lang === "ar";
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  // Every card links to /categories/[slug], and that page refuses to
  // exist below MIN_BUSINESSES. Sorted by count, the tail of this list
  // is the empty categories, which used to link straight into a 404.
  const shown = categories.filter((c) => c.count > 0).slice(0, limit);
  if (shown.length === 0) return null;

  // Shown, never linked: their pages do not exist yet.
  const upcoming = upcomingCategories(categories, UPCOMING_CHIPS);

  return (
    <section
      className="pb-4 pt-20"
      // Starts on the page's ground, so there is no seam under the hero
      // (whose wash ends transparent), then rises into the hero's mint.
      style={{
        background:
          "radial-gradient(520px 320px at 18% 62%, rgb(79 169 139 / 0.18), transparent 70%)," +
          "radial-gradient(520px 320px at 84% 40%, rgb(13 122 90 / 0.12), transparent 70%)," +
          "linear-gradient(180deg, var(--color-ground) 0%, #EEF5F1 28%, var(--color-jade-tint) 70%, var(--color-ground) 100%)",
      }}
    >
      <div className="container-app">

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <span className="section-eyebrow">{c.eyebrow}</span>
            <h2 className="section-title mt-2.5">{c.title}</h2>
          </div>
          <Link href="/categories" className="btn btn-outline btn-pill btn-sm shrink-0 bg-[var(--color-surface)]">
            {c.viewAll}
            <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>

        {/* Two across even on a phone: one full-width card each made six
            categories a long scroll before anything bookable. */}
        <ul className="grid list-none grid-cols-2 gap-3.5 p-0 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          {shown.map((cat) => {
            const name = isAr ? cat.nameAr : cat.nameEn;
            return (
              <li key={cat.id} className="min-w-0">
                <Link
                  href={`/categories/${cat.slug}`}
                  className="group block overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface)] shadow-[0_14px_34px_rgb(17_32_28/0.08)] transition-shadow hover:shadow-[0_18px_44px_rgb(17_32_28/0.14)]"
                >
                  <span
                    role="img"
                    aria-label={name}
                    className={`block h-28 sm:h-36 lg:h-44 transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none ${coverClassFor(cat.slug)}`}
                  />
                  <span className="relative block bg-[var(--color-surface)] px-4 pb-4 pt-3.5 sm:px-6 sm:pb-6 sm:pt-5">
                    <span className="block truncate text-[0.96875rem] font-bold text-[var(--color-ink)] sm:text-[1.25rem]">
                      {name}
                    </span>
                    <span className="mt-1 block text-[0.78125rem] text-[var(--color-muted)] sm:text-[0.84375rem]">
                      {countText(lang, cat.count, c.countSuffix)}
                    </span>
                    <span className="mt-3.5 hidden items-center gap-2 text-[0.875rem] font-bold text-[var(--color-jade)] sm:inline-flex">
                      {isAr ? "شوف المواعيد" : "See openings"}
                      <ArrowIcon size={15} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {upcoming.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="me-1.5 text-[0.875rem] font-bold text-[var(--color-ink)]">
              {isAr ? "قريبًا على موعد" : "Coming soon"}
            </span>
            <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
              {upcoming.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-jade-line)] bg-[rgb(255_255_255/0.7)] py-1.5 pe-4 ps-1.5 text-[0.875rem] text-[var(--color-muted)]"
                >
                  <span aria-hidden="true" className={`size-[1.625rem] shrink-0 rounded-full grayscale ${coverClassFor(cat.slug)}`} />
                  {isAr ? cat.nameAr : cat.nameEn || cat.nameAr}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
