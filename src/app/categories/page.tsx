"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Search } from "lucide-react";
import { coverClassFor } from "@/lib/category-cover";

// ─── Types ─────────────────────────────────────────────────

type Category = {
  id:       string;
  slug:     string;
  nameAr:   string;
  nameEn:   string;
  icon:     string;
  bgColor:  string;
  color?:   string;
  iconSvg?: string;
};

// ─── Static fallback data ───────────────────────────────────

const STATIC_CATS: Category[] = [
  { id:"1", slug:"clinics",     nameAr:"عيادات",       nameEn:"Clinics",        icon:"🏥", bgColor:"var(--color-info-soft)", color:"var(--color-info)" },
  { id:"2", slug:"salons",      nameAr:"صالونات",       nameEn:"Salons",         icon:"✂️", bgColor:"var(--color-jade-tint)", color:"var(--color-jade-hover)" },
  { id:"3", slug:"restaurants", nameAr:"مطاعم",         nameEn:"Restaurants",    icon:"🍽️", bgColor:"var(--color-warn-soft)", color:"var(--color-warn)" },
  { id:"4", slug:"gyms",        nameAr:"جيم وفيتنس",    nameEn:"Gyms & Fitness", icon:"💪", bgColor:"var(--color-ok-soft)", color:"var(--color-ok)" },
  { id:"5", slug:"spas",        nameAr:"سبا وتدليك",    nameEn:"Spa & Massage",  icon:"🧖", bgColor:"var(--color-jade-tint)", color:"var(--color-jade-hover)" },
  { id:"6", slug:"dentists",    nameAr:"طب أسنان",      nameEn:"Dentistry",      icon:"🦷", bgColor:"var(--color-info-soft)", color:"var(--color-info)" },
  { id:"7", slug:"labs",        nameAr:"مختبرات",       nameEn:"Medical Labs",   icon:"🔬", bgColor:"var(--color-danger-soft)", color:"var(--color-danger)" },
  { id:"8", slug:"photography", nameAr:"تصوير",         nameEn:"Photography",    icon:"📸", bgColor:"var(--color-warn-soft)", color:"var(--color-warn)" },
];

// ─── Provider count metadata ────────────────────────────────

const SLUG_META: Record<string, { countAr: string; countEn: string }> = {
  // Static slugs
  clinics:     { countAr: "240+ عيادة",      countEn: "240+ clinics"      },
  salons:      { countAr: "320+ صالون",       countEn: "320+ salons"       },
  restaurants: { countAr: "180+ مطعم",        countEn: "180+ restaurants"  },
  gyms:        { countAr: "140+ جيم",         countEn: "140+ gyms"         },
  spas:        { countAr: "90+ مركز",         countEn: "90+ centers"       },
  dentists:    { countAr: "185+ عيادة",       countEn: "185+ clinics"      },
  labs:        { countAr: "70+ مختبر",        countEn: "70+ labs"          },
  photography: { countAr: "60+ مصور",         countEn: "60+ studios"       },
  // DB slugs (if API returns these)
  medical:     { countAr: "240+ مقدم خدمة",  countEn: "240+ providers"    },
  dental:      { countAr: "185+ عيادة",       countEn: "185+ clinics"      },
  beauty:      { countAr: "320+ صالون",       countEn: "320+ salons"       },
  fitness:     { countAr: "140+ جيم",         countEn: "140+ gyms"         },
  legal:       { countAr: "90+ محامي",        countEn: "90+ lawyers"       },
  consulting:  { countAr: "110+ مستشار",      countEn: "110+ advisors"     },
  education:   { countAr: "200+ مدرّس",       countEn: "200+ tutors"       },
  veterinary:  { countAr: "70+ عيادة",        countEn: "70+ clinics"       },
};

function getCount(slug: string, lang: "ar" | "en", idx: number): string {
  if (SLUG_META[slug]) return lang === "ar" ? SLUG_META[slug].countAr : SLUG_META[slug].countEn;
  const fallback = ["60+", "85+", "45+", "120+", "55+", "75+", "95+", "30+"];
  const n = fallback[idx % fallback.length];
  return lang === "ar" ? `${n} مقدم خدمة` : `${n} providers`;
}

// ─── Page ──────────────────────────────────────────────────

export default function CategoriesPage() {
  const { t, lang } = useLanguage();
  const c    = t.categoriesPage;
  const isAr = lang === "ar";
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [categories, setCategories] = useState<Category[]>(STATIC_CATS);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setCategories(data);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Navbar />
      <main className="bg-[var(--color-ground)]">
        <PageHero badge={c.eyebrow} title={c.title} subtitle={c.subtitle} />

        <section className="py-14">
          <div className="container-app">
            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((cat, idx) => {
                const name  = isAr ? cat.nameAr : (cat.nameEn || cat.nameAr);
                const count = getCount(cat.slug, lang, idx);

                return (
                  <li key={cat.id} className="min-w-0">
                    <Link
                      href={`/businesses?category=${cat.slug}`}
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
                          {count}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════
            Bottom CTA
        ════════════════════════════════════════ */}
        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="max-w-lg mx-auto">
              <div
                className="rounded-[var(--radius-xl)] p-5 sm:p-8 text-center overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, rgba(14,127,94,0.06) 0%, rgba(14,127,94,0.04) 100%)",
                  border:     "1px solid rgba(14,127,94,0.18)",
                  boxShadow:  "0 2px 16px rgba(14,127,94,0.07)",
                }}
              >
                {/* Dot-grid texture */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(14,127,94,0.07) 1px, transparent 1px)",
                    backgroundSize:  "20px 20px",
                  }}
                />

                <div className="relative z-10">

                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 14px rgba(14,127,94,0.35)",
                    }}
                  >
                    <Search size={20} className="text-white" strokeWidth={1.75} />
                  </div>

                  <p
                    className="text-base font-bold text-[var(--color-ink)] mb-1.5"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {c.notFoundTitle}
                  </p>
                  <p className="text-sm text-[var(--color-muted)] mb-6" style={{ lineHeight: 1.7 }}>
                    {c.notFoundSub}
                  </p>

                  <Link
                    href="/businesses"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-[var(--radius-lg)] text-sm font-bold text-white transition-all duration-200 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 16px rgba(14,127,94,0.40)",
                    }}
                  >
                    {c.viewAll}
                    <ArrowIcon size={14} strokeWidth={2.5} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
