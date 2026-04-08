"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

type HeroCategory = { id: string; slug: string; nameAr: string; nameEn: string; icon: string };
type HeroCity     = { id: string; slug: string; nameAr: string; nameEn: string };

interface Props {
  categories: HeroCategory[];
  cities:     HeroCity[];
}

export default function HeroSection({ categories, cities }: Props) {
  const { t, lang } = useLanguage();
  const h = t.hero;
  const router       = useRouter();
  const [q,        setQ]        = useState("");
  const [cityId,   setCityId]   = useState("");
  const [cityOpen, setCityOpen] = useState(false);

  const selectedCityName = cities.find((c) => c.id === cityId)
    ? (lang === "en" ? (cities.find((c) => c.id === cityId)?.nameEn || cities.find((c) => c.id === cityId)?.nameAr) : cities.find((c) => c.id === cityId)?.nameAr)
    : h.allCities;

  function search() {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q",    q.trim());
    if (cityId)   p.set("city", cityId);
    router.push(`/businesses${p.size ? `?${p}` : ""}`);
  }

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-16">
      {/* Background decoration */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -end-40 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-orange-50 via-rose-50 to-transparent opacity-70" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #0A0A0A 1px, transparent 1px)",
            backgroundSize:  "32px 32px",
          }}
        />
      </div>

      <div className="container-app relative z-10 py-20">
        <div className="max-w-2xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[var(--color-accent-light)] text-[var(--color-accent)] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            {h.eyebrow}
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 text-[var(--color-text-primary)]">
            {h.title}
            <br />
            <span className="gradient-text">{h.titleAccent}</span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-10 leading-relaxed whitespace-pre-line">
            {h.subtitle}
          </p>

          {/* Search bar */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[var(--color-border)] p-1.5 flex flex-col sm:flex-row gap-1.5 mb-6">
            <div className="flex items-center gap-3 flex-1 px-4 py-2">
              <Search size={18} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                type="text"
                placeholder={h.searchPlaceholder}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                className="w-full text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                dir={lang === "en" ? "ltr" : "rtl"}
              />
              {q && (
                <button type="button" onClick={() => setQ("")}>
                  <X size={14} className="text-[var(--color-text-muted)]" />
                </button>
              )}
            </div>

            <div className="hidden sm:block w-px bg-[var(--color-border)] my-1" />

            {/* City picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setCityOpen(!cityOpen)}
                className="flex items-center gap-2 px-4 py-2 sm:w-44 w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <MapPin size={16} className="shrink-0" />
                <span className="flex-1 text-start truncate">{selectedCityName}</span>
                <ChevronDown size={14} className={`transition-transform shrink-0 ${cityOpen ? "rotate-180" : ""}`} />
              </button>
              {cityOpen && (
                <div className="absolute top-full start-0 mt-1 w-52 bg-white border border-[var(--color-border)] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => { setCityId(""); setCityOpen(false); }}
                    className="w-full text-start px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors font-medium text-[var(--color-text-primary)]"
                  >
                    {h.allCities}
                  </button>
                  {cities.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => { setCityId(city.id); setCityOpen(false); }}
                      className={`w-full text-start px-4 py-2.5 text-sm hover:bg-[var(--color-surface-2)] transition-colors ${
                        cityId === city.id
                          ? "text-[var(--color-accent)] font-semibold"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {lang === "en" ? (city.nameEn || city.nameAr) : city.nameAr}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={search}
              className="btn btn-accent shrink-0 rounded-xl px-6"
            >
              {h.searchBtn}
            </button>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.slice(0, 7).map((cat) => (
              <Link
                key={cat.id}
                href={`/businesses?category=${cat.slug}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all duration-150"
              >
                <span>{cat.icon}</span>
                <span>{lang === "en" ? (cat.nameEn || cat.nameAr) : cat.nameAr}</span>
              </Link>
            ))}
          </div>

          {/* Trust stats */}
          <div className="flex items-center justify-center gap-8 md:gap-12">
            {h.stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-3xl font-black text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"
      />
    </section>
  );
}
