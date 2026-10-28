"use client";

import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { coverClassFor } from "@/lib/category-cover";
import { countText } from "@/lib/i18n";
import type { CategoryWithCount } from "@/lib/data";

interface Props {
  categories: CategoryWithCount[];
  /** How many to show before the "all categories" link takes over. */
  limit?: number;
}

/**
 * Browse by what you need done.
 *
 * Counts come from the database. This section used to carry a table
 * of invented ones — "240+ providers" for medical, "320+ salons" for
 * beauty — keyed by slug, with a rotating list of plausible numbers
 * for any slug that table missed.
 */
export default function CategoriesSection({ categories, limit = 8 }: Props) {
  const { t, lang } = useLanguage();
  const c = t.categories;
  const isAr = lang === "ar";
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  // Every tile links to /categories/[slug], and that page refuses to
  // exist below MIN_BUSINESSES. Sorted by count, the tail of this list
  // is the empty categories — four of the eight shown here linked
  // straight into a 404.
  const shown = categories.filter((c) => c.count > 0).slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <span className="section-eyebrow">{c.eyebrow}</span>
            <h2 className="section-title mt-2.5">{c.title}</h2>
          </div>
          <Link href="/categories" className="btn btn-outline btn-pill btn-sm shrink-0">
            {c.viewAll}
            <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>

        {/* Wrapping rows, centred: a short last row sits in the middle
            instead of leaving a hole at the end (three tiles in a
            four-column grid did). Widths match the old 2/3/4 columns. */}
        <ul className="flex list-none flex-wrap justify-center gap-4 p-0">
          {shown.map((cat) => {
            const name = isAr ? cat.nameAr : cat.nameEn;
            return (
              <li
                key={cat.id}
                className="min-w-0 basis-[calc((100%-1rem)/2)] sm:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-3rem)/4)]"
              >
                <Link
                  href={`/categories/${cat.slug}`}
                  className="card card-hover block overflow-hidden"
                >
                  <span
                    role="img"
                    aria-label={name}
                    className={`block h-[8.5rem] ${coverClassFor(cat.slug)}`}
                  />
                  <span className="block px-5 pb-5 pt-4">
                    <span className="block truncate text-base font-bold text-[var(--color-ink)]">
                      {name}
                    </span>
                    <span className="mt-1 block text-[0.78125rem] text-[var(--color-subtle)]">
                      {cat.count > 0 ? (
                        countText(lang, cat.count, c.countSuffix)
                      ) : (
                        // Honest about a category nobody has listed in
                        // yet — and it reads as an invitation.
                        c.countEmpty
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
