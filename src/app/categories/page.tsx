"use client";

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, Search } from "lucide-react";

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
  { id:"1", slug:"clinics",     nameAr:"عيادات",       nameEn:"Clinics",        icon:"🏥", bgColor:"#F0F9FF", color:"#0369A1" },
  { id:"2", slug:"salons",      nameAr:"صالونات",       nameEn:"Salons",         icon:"✂️", bgColor:"#FDF2F8", color:"#9D174D" },
  { id:"3", slug:"restaurants", nameAr:"مطاعم",         nameEn:"Restaurants",    icon:"🍽️", bgColor:"#FFFBEB", color:"#92400E" },
  { id:"4", slug:"gyms",        nameAr:"جيم وفيتنس",    nameEn:"Gyms & Fitness", icon:"💪", bgColor:"#ECFDF5", color:"#065F46" },
  { id:"5", slug:"spas",        nameAr:"سبا وتدليك",    nameEn:"Spa & Massage",  icon:"🧖", bgColor:"#F5F3FF", color:"#5B21B6" },
  { id:"6", slug:"dentists",    nameAr:"طب أسنان",      nameEn:"Dentistry",      icon:"🦷", bgColor:"#ECFEFF", color:"#155E75" },
  { id:"7", slug:"labs",        nameAr:"مختبرات",       nameEn:"Medical Labs",   icon:"🔬", bgColor:"#FEF2F2", color:"#991B1B" },
  { id:"8", slug:"photography", nameAr:"تصوير",         nameEn:"Photography",    icon:"📸", bgColor:"#FFF7ED", color:"#9A3412" },
];

// ─── Provider count metadata ────────────────────────────────

const SLUG_META: Record<string, { countAr: string; countEn: string }> = {
  // Static slugs
  clinics:     { countAr: "٢٤٠+ عيادة",      countEn: "240+ clinics"      },
  salons:      { countAr: "٣٢٠+ صالون",       countEn: "320+ salons"       },
  restaurants: { countAr: "١٨٠+ مطعم",        countEn: "180+ restaurants"  },
  gyms:        { countAr: "١٤٠+ جيم",         countEn: "140+ gyms"         },
  spas:        { countAr: "٩٠+ مركز",         countEn: "90+ centers"       },
  dentists:    { countAr: "١٨٥+ عيادة",       countEn: "185+ clinics"      },
  labs:        { countAr: "٧٠+ مختبر",        countEn: "70+ labs"          },
  photography: { countAr: "٦٠+ مصور",         countEn: "60+ studios"       },
  // DB slugs (if API returns these)
  medical:     { countAr: "٢٤٠+ مقدم خدمة",  countEn: "240+ providers"    },
  dental:      { countAr: "١٨٥+ عيادة",       countEn: "185+ clinics"      },
  beauty:      { countAr: "٣٢٠+ صالون",       countEn: "320+ salons"       },
  fitness:     { countAr: "١٤٠+ جيم",         countEn: "140+ gyms"         },
  legal:       { countAr: "٩٠+ محامي",        countEn: "90+ lawyers"       },
  consulting:  { countAr: "١١٠+ مستشار",      countEn: "110+ advisors"     },
  education:   { countAr: "٢٠٠+ مدرّس",       countEn: "200+ tutors"       },
  veterinary:  { countAr: "٧٠+ عيادة",        countEn: "70+ clinics"       },
};

function getCount(slug: string, lang: "ar" | "en", idx: number): string {
  if (SLUG_META[slug]) return lang === "ar" ? SLUG_META[slug].countAr : SLUG_META[slug].countEn;
  const fallback = ["٦٠+", "٨٥+", "٤٥+", "١٢٠+", "٥٥+", "٧٥+", "٩٥+", "٣٠+"];
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
      <main
        className="min-h-screen"
        style={{ background: "#F8FAFC" }}
        dir={isAr ? "rtl" : "ltr"}
      >
        <PageHero
          badge={c.eyebrow}
          title={c.title}
          subtitle={c.subtitle}
          dir={isAr ? "rtl" : "ltr"}
        />

        {/* ════════════════════════════════════════
            Category grid
        ════════════════════════════════════════ */}
        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {categories.map((cat, idx) => {
                const name  = isAr ? cat.nameAr : (cat.nameEn || cat.nameAr);
                const count = getCount(cat.slug, lang, idx);

                return (
                  <Link
                    key={cat.id}
                    href={`/businesses?category=${cat.slug}`}
                    className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#E2E8F0] bg-white text-center"
                    style={{
                      boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
                      transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.boxShadow   = "0 8px 28px rgba(59,130,246,0.12), 0 2px 8px rgba(15,23,42,0.06)";
                      el.style.transform   = "translateY(-4px)";
                      el.style.borderColor = "rgba(147,197,253,0.70)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.boxShadow   = "0 1px 4px rgba(15,23,42,0.04)";
                      el.style.transform   = "translateY(0)";
                      el.style.borderColor = "#E2E8F0";
                    }}
                  >
                    {/* Icon container */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110 shrink-0"
                      style={{ background: cat.bgColor || "#EFF6FF" }}
                    >
                      {cat.iconSvg ? (
                        <Image
                          src={cat.iconSvg}
                          alt={name}
                          width={28}
                          height={28}
                          className="object-contain"
                        />
                      ) : (
                        <span>{cat.icon}</span>
                      )}
                    </div>

                    {/* Name + count */}
                    <div>
                      <span className="block text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors duration-150 leading-snug">
                        {name}
                      </span>
                      <span className="block text-[10px] text-[#94A3B8] mt-0.5 leading-tight">
                        {count}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            Bottom CTA
        ════════════════════════════════════════ */}
        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="max-w-lg mx-auto">
              <div
                className="rounded-3xl p-8 text-center overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.04) 100%)",
                  border:     "1px solid rgba(59,130,246,0.18)",
                  boxShadow:  "0 2px 16px rgba(59,130,246,0.07)",
                }}
              >
                {/* Dot-grid texture */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.07) 1px, transparent 1px)",
                    backgroundSize:  "20px 20px",
                  }}
                />

                <div className="relative z-10">

                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                      boxShadow:  "0 4px 14px rgba(59,130,246,0.35)",
                    }}
                  >
                    <Search size={20} className="text-white" strokeWidth={1.75} />
                  </div>

                  <p
                    className="text-base font-bold text-[#0F172A] mb-1.5"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {c.notFoundTitle}
                  </p>
                  <p className="text-sm text-[#475569] mb-6" style={{ lineHeight: 1.7 }}>
                    {c.notFoundSub}
                  </p>

                  <Link
                    href="/businesses"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-bold text-white transition-all duration-200"
                    style={{
                      background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                      boxShadow:  "0 4px 16px rgba(59,130,246,0.40)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.boxShadow = "0 6px 22px rgba(59,130,246,0.52)";
                      el.style.filter    = "brightness(1.06)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.boxShadow = "0 4px 16px rgba(59,130,246,0.40)";
                      el.style.filter    = "";
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
