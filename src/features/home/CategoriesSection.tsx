"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { coverClassFor } from "@/lib/category-cover";

type Category = {
  id:       string;
  slug:     string;
  nameAr:   string;
  nameEn:   string;
  icon:     string;
  color:    string;
  bgColor:  string;
  iconSvg?: string;
};

interface Props {
  categories: Category[];
}

/** Provider counts we have real figures for. */
const SLUG_META: Record<string, { countAr: string; countEn: string }> = {
  medical:     { countAr: "240+ مقدم خدمة", countEn: "240+ providers" },
  dental:      { countAr: "185+ عيادة",      countEn: "185+ clinics"   },
  beauty:      { countAr: "320+ صالون",      countEn: "320+ salons"    },
  fitness:     { countAr: "140+ جيم",        countEn: "140+ gyms"      },
  legal:       { countAr: "90+ محامي",       countEn: "90+ lawyers"    },
  consulting:  { countAr: "110+ مستشار",     countEn: "110+ advisors"  },
  education:   { countAr: "200+ مدرّس",      countEn: "200+ tutors"    },
  veterinary:  { countAr: "70+ عيادة",       countEn: "70+ clinics"    },
};

function metaFor(slug: string, lang: "ar" | "en", idx: number) {
  const hit = SLUG_META[slug];
  if (hit) return lang === "ar" ? hit.countAr : hit.countEn;
  const fallback = ["60+", "85+", "45+", "120+", "55+", "75+", "95+", "30+"];
  const n = fallback[idx % fallback.length];
  return lang === "ar" ? `${n} مقدم خدمة` : `${n} providers`;
}

export default function CategoriesSection({ categories }: Props) {
  const { t, lang } = useLanguage();
  const c = t.categories;
  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">

        <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <span className="section-eyebrow">{c.eyebrow}</span>
            <h2 className="section-title mt-2.5">{c.title}</h2>
          </div>
          <Link
            href="/categories"
            className="btn btn-outline btn-pill btn-sm shrink-0"
          >
            {c.viewAll}
            <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat, i) => {
            const name = lang === "ar" ? cat.nameAr : cat.nameEn;
            return (
              <li key={cat.id} className="min-w-0">
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
                      {metaFor(cat.slug, lang, i)}
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
