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
  "#F0F9FF","#F0FDF4","#F5F3FF","#FFF7ED","#FDF2F8",
  "#ECFEFF","#FFFBEB","#FEF2F2","#EEF2FF","#ECFDF5",
];
const cityIconColors = [
  "#0369A1","#15803D","#7C3AED","#EA580C","#9D174D",
  "#0E7490","#B45309","#991B1B","#4338CA","#065F46",
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

        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayCities.map(({ key, href, name, bg, color }) => (
                <Link
                  key={key}
                  href={href}
                  className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#E2E8F0] bg-white text-center"
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
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shrink-0"
                    style={{ background: bg }}
                  >
                    <MapPin size={22} style={{ color }} strokeWidth={1.75} />
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors duration-150 leading-snug">
                    {name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="max-w-lg mx-auto">
              <div
                className="rounded-3xl p-5 sm:p-8 text-center overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(99,102,241,0.04) 100%)",
                  border:     "1px solid rgba(59,130,246,0.18)",
                  boxShadow:  "0 2px 16px rgba(59,130,246,0.07)",
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(59,130,246,0.07) 1px, transparent 1px)",
                    backgroundSize:  "20px 20px",
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                      boxShadow:  "0 4px 14px rgba(59,130,246,0.35)",
                    }}
                  >
                    <MapPin size={20} className="text-white" strokeWidth={1.75} />
                  </div>
                  <p className="text-base font-bold text-[#0F172A] mb-1.5">{c.notFoundTitle}</p>
                  <p className="text-sm text-[#475569] mb-6" style={{ lineHeight: 1.7 }}>{c.notFoundSub}</p>
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
