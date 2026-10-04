"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

type City = { id: string; slug: string; nameAr: string; nameEn: string };

const staticCitiesAr = [
  "القاهرة","الإسكندرية","الجيزة","الشرقية","المنوفية",
  "البحيرة","المنيا","أسيوط","سوهاج","قنا",
  "الأقصر","أسوان","الدقهلية","كفر الشيخ","دمياط",
  "بورسعيد","الإسماعيلية","السويس","مطروح","الوادي الجديد",
];
const staticCitiesEn = [
  "Cairo","Alexandria","Giza","Sharqia","Monufia",
  "Beheira","Minya","Asyut","Sohag","Qena",
  "Luxor","Aswan","Dakahlia","Kafr el-Sheikh","Damietta",
  "Port Said","Ismailia","Suez","Matrouh","New Valley",
];

const cityColors = [
  "var(--color-info-soft)","var(--color-ok-soft)","var(--color-jade-tint)","var(--color-warn-soft)","var(--color-jade-tint)",
  "var(--color-info-soft)","var(--color-warn-soft)","var(--color-danger-soft)","var(--color-jade-tint)","var(--color-ok-soft)",
];
const cityIconColors = [
  "var(--color-info)","var(--color-ok)","var(--color-jade)","var(--color-warn)","var(--color-jade-hover)",
  "var(--color-info)","var(--color-warn)","var(--color-danger)","var(--color-jade-hover)","var(--color-ok)",
];

export default function CitiesPage() {
  const { t, lang } = useLanguage();
  const c    = t.citiesPage;
  const isAr = lang === "ar";
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    fetch("/api/cities").then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data) && data.length > 0) setCities(data);
    }).catch(() => {});
  }, []);

  const displayCities = cities.length > 0
    ? cities.map((city, i) => ({
        key:   city.id,
        href:  `/businesses?city=${city.id}`,
        name:  isAr ? city.nameAr : (city.nameEn || city.nameAr),
        bg:    cityColors[i % cityColors.length],
        color: cityIconColors[i % cityIconColors.length],
      }))
    : staticCitiesAr.map((nameAr, i) => ({
        key:   nameAr,
        href:  `/businesses?q=${nameAr}`,
        name:  isAr ? nameAr : staticCitiesEn[i],
        bg:    cityColors[i % cityColors.length],
        color: cityIconColors[i % cityIconColors.length],
      }));

  return (
    <>
      <Navbar />
      <main className="bg-[var(--color-ground)]">
        <PageHero
          badge={c.eyebrow}
          title={c.title}
          subtitle={c.subtitle}
          dir={isAr ? "rtl" : "ltr"}
        />

        <section className="py-14">
          <div className="container-app">
            <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {displayCities.map(({ key, href, name }) => (
                <li key={key} className="min-w-0">
                  <Link
                    href={href}
                    className="card card-hover flex min-h-[4.5rem] items-center gap-3.5 px-5"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)]"
                    >
                      <MapPin size={19} strokeWidth={1.8} className="text-[var(--color-jade)]" />
                    </span>
                    <span className="truncate text-[0.9375rem] font-bold text-[var(--color-ink)]">
                      {name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="max-w-lg mx-auto">
              <div
                className="rounded-3xl p-5 sm:p-8 text-center overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, rgba(14,127,94,0.06) 0%, rgba(14,127,94,0.04) 100%)",
                  border:     "1px solid rgba(14,127,94,0.18)",
                  boxShadow:  "0 2px 16px rgba(14,127,94,0.07)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(14,127,94,0.07) 1px, transparent 1px)",
                    backgroundSize:  "20px 20px",
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 14px rgba(14,127,94,0.35)",
                    }}
                  >
                    <MapPin size={20} className="text-white" strokeWidth={1.75} />
                  </div>
                  <p className="text-base font-bold text-[var(--color-ink)] mb-1.5">{c.notFoundTitle}</p>
                  <p className="text-sm text-[var(--color-muted)] mb-6" style={{ lineHeight: 1.7 }}>{c.notFoundSub}</p>
                  <Link
                    href="/businesses"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-bold text-white transition-all duration-200 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 16px rgba(14,127,94,0.40)",
                    }}
                  >
                    {c.viewAll}
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
