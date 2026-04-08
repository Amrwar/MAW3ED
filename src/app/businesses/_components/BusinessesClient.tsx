"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, MapPin, Sparkles } from "lucide-react";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import type { PublicBusiness } from "@/lib/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type Category = { id: string; slug: string; nameAr: string; nameEn: string; icon: string };
type City     = { id: string; slug: string; nameAr: string; nameEn: string };

interface Props {
  businesses:      PublicBusiness[];
  categories:      Category[];
  cities:          City[];
  initialQ:        string;
  initialCity:     string;
  initialCategory: string;
}

// ─── Sidebar section wrapper ──────────────────────────────

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        border:     "1px solid #E2E8F0",
        boxShadow:  "0 1px 4px rgba(15,23,42,0.04)",
      }}
    >
      <div className="px-4 py-3" style={{ borderBottom: "1px solid #F1F5F9" }}>
        <h3 className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

// ─── Sidebar filter item ──────────────────────────────────

function SidebarItem({
  active,
  onClick,
  icon,
  label,
}: {
  active:  boolean;
  onClick: () => void;
  icon:    React.ReactNode;
  label:   string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 text-start",
        active
          ? "bg-[#DBEAFE] text-[#1D4ED8]"
          : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
      )}
    >
      <span className={cn("shrink-0", active ? "opacity-100" : "opacity-50")}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────

export default function BusinessesClient({
  businesses,
  categories,
  cities,
  initialQ,
  initialCity,
  initialCategory,
}: Props) {
  const { t, lang } = useLanguage();
  const b    = t.businesses;
  const isAr = lang === "ar";

  const router               = useRouter();
  const [isPending, startTx] = useTransition();
  const [q,        setQ]        = useState(initialQ);
  const [city,     setCity]     = useState(initialCity);
  const [category, setCategory] = useState(initialCategory);

  function apply(nQ: string, nCity: string, nCat: string) {
    const p = new URLSearchParams();
    if (nQ)    p.set("q",        nQ);
    if (nCity) p.set("city",     nCity);
    if (nCat)  p.set("category", nCat);
    startTx(() => router.push(`/businesses${p.size ? `?${p}` : ""}`));
  }

  function clearAll() {
    setQ(""); setCity(""); setCategory("");
    apply("", "", "");
  }

  const selectedCat  = categories.find((c) => c.slug === category);
  const selectedCity = cities.find((c) => c.id === city);
  const hasFilters   = !!(q || city || category);

  const getName = (item: Category | City) =>
    lang === "en" ? (item.nameEn || item.nameAr) : item.nameAr;

  const catName  = selectedCat  ? getName(selectedCat)  : null;
  const cityName = selectedCity ? getName(selectedCity) : null;

  // Featured = first 2 businesses (only when no active filters and enough results)
  const showFeatured  = !hasFilters && businesses.length >= 3;
  const featuredBizs  = showFeatured ? businesses.slice(0, 2)  : [];
  const regularBizs   = showFeatured ? businesses.slice(2)     : businesses;

  return (
    <div
      className="min-h-screen"
      style={{ background: "#F8FAFC" }}
      dir={isAr ? "rtl" : "ltr"}
    >

      {/* Ambient background glow */}
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 h-96 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 100%)",
          zIndex: 0,
        }}
      />

      {/* ── Sticky search bar ── */}
      <div
        className="sticky top-16 z-30"
        style={{
          background:    "rgba(255,255,255,0.97)",
          backdropFilter:"blur(12px)",
          borderBottom:  "1px solid #E2E8F0",
          boxShadow:     "0 2px 12px rgba(15,23,42,0.05)",
        }}
      >
        <div className="container-app py-3">

          {/* Search row */}
          <form
            onSubmit={(e) => { e.preventDefault(); apply(q, city, category); }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            {/* Search input */}
            <div
              className="flex items-center gap-2.5 flex-1 rounded-2xl px-4 py-2.5 transition-all duration-150"
              style={{
                background: "#F8FAFC",
                border:     "1.5px solid #E2E8F0",
              }}
            >
              <Search size={15} className="text-[#94A3B8] shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={b.searchPlaceholder}
                dir={isAr ? "rtl" : "ltr"}
                className="flex-1 text-sm bg-transparent outline-none text-[#0F172A] placeholder:text-[#94A3B8]"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => { setQ(""); apply("", city, category); }}
                  className="shrink-0"
                >
                  <X size={13} className="text-[#94A3B8] hover:text-[#475569] transition-colors" />
                </button>
              )}
            </div>

            {/* City dropdown */}
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); apply(q, e.target.value, category); }}
              className="rounded-2xl px-4 py-2.5 text-sm text-[#475569] outline-none sm:w-44 cursor-pointer"
              style={{
                background: "#F8FAFC",
                border:     "1.5px solid #E2E8F0",
              }}
            >
              <option value="">{b.allCities}</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{getName(c)}</option>
              ))}
            </select>

            {/* Search button */}
            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all duration-150"
              style={{
                background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                boxShadow:  "0 2px 10px rgba(59,130,246,0.35)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.boxShadow = "0 4px 18px rgba(59,130,246,0.50)";
                el.style.filter    = "brightness(1.06)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.boxShadow = "0 2px 10px rgba(59,130,246,0.35)";
                el.style.filter    = "";
              }}
            >
              {b.searchBtn}
            </button>
          </form>

          {/* Category chips — visible on mobile/tablet only */}
          <div
            className="lg:hidden flex gap-2 mt-2.5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => { setCategory(""); apply(q, city, ""); }}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={
                !category
                  ? { background: "#3B82F6", color: "#fff", border: "1.5px solid #3B82F6" }
                  : { background: "#fff",    color: "#475569", border: "1.5px solid #E2E8F0" }
              }
            >
              {b.allCategories}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.slug); apply(q, city, cat.slug); }}
                className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={
                  category === cat.slug
                    ? { background: "#3B82F6", color: "#fff", border: "1.5px solid #3B82F6" }
                    : { background: "#fff",    color: "#475569", border: "1.5px solid #E2E8F0" }
                }
              >
                <span>{cat.icon}</span>
                {getName(cat)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="container-app py-8 relative z-10">
        <div className="flex gap-7">

          {/* ════════════════════════════════════
              Sidebar (desktop only)
          ════════════════════════════════════ */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-36 space-y-4">

              {/* Active filters */}
              {hasFilters && (
                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(59,130,246,0.05)",
                    border:     "1px solid rgba(59,130,246,0.20)",
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-widest">
                      {isAr ? "الفلاتر" : "Active Filters"}
                    </span>
                    <button
                      onClick={clearAll}
                      className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-semibold transition-colors"
                    >
                      {b.clearFilters}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {catName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold">
                        <span>{selectedCat?.icon}</span>
                        {catName}
                        <button
                          onClick={() => { setCategory(""); apply(q, city, ""); }}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </span>
                    )}
                    {cityName && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold">
                        {cityName}
                        <button
                          onClick={() => { setCity(""); apply(q, "", category); }}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </span>
                    )}
                    {q && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#DBEAFE] text-[#1D4ED8] text-xs font-semibold">
                        &ldquo;{q}&rdquo;
                        <button
                          onClick={() => { setQ(""); apply("", city, category); }}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X size={10} strokeWidth={2.5} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Cities — first, per requested tab order */}
              <SidebarSection title={isAr ? "المدن" : "Cities"}>
                <SidebarItem
                  active={!city}
                  onClick={() => { setCity(""); apply(q, "", category); }}
                  icon={<MapPin size={13} />}
                  label={b.allCities}
                />
                {cities.map((c) => (
                  <SidebarItem
                    key={c.id}
                    active={city === c.id}
                    onClick={() => { setCity(c.id); apply(q, c.id, category); }}
                    icon={<MapPin size={13} />}
                    label={getName(c)}
                  />
                ))}
              </SidebarSection>

              {/* Categories — second */}
              <SidebarSection title={isAr ? "التصنيفات" : "Categories"}>
                <SidebarItem
                  active={!category}
                  onClick={() => { setCategory(""); apply(q, city, ""); }}
                  icon={<span className="text-base">🔍</span>}
                  label={b.allCategories}
                />
                {categories.map((cat) => (
                  <SidebarItem
                    key={cat.id}
                    active={category === cat.slug}
                    onClick={() => { setCategory(cat.slug); apply(q, city, cat.slug); }}
                    icon={<span className="text-base">{cat.icon}</span>}
                    label={getName(cat)}
                  />
                ))}
              </SidebarSection>

            </div>
          </aside>

          {/* ════════════════════════════════════
              Results area
          ════════════════════════════════════ */}
          <div className="flex-1 min-w-0">

            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1
                  className="text-xl font-black text-[#0F172A]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {catName
                    ? `${selectedCat?.icon} ${catName}`
                    : b.browseBusiness}
                  {cityName ? ` · ${cityName}` : ""}
                </h1>
                <p className="text-sm text-[#94A3B8] mt-0.5">
                  {isPending
                    ? b.searching
                    : `${businesses.length} ${b.results}`}
                </p>
              </div>

              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="lg:hidden flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                >
                  <X size={13} strokeWidth={2.5} />
                  {b.clearFilters}
                </button>
              )}
            </div>

            {businesses.length > 0 ? (
              <div
                className={cn(
                  "transition-opacity duration-200",
                  isPending && "opacity-50 pointer-events-none",
                )}
              >

                {/* Featured row (no filters, ≥3 results) */}
                {showFeatured && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={13} className="text-[#3B82F6]" />
                      <span className="text-xs font-bold text-[#3B82F6] uppercase tracking-widest">
                        {isAr ? "أبرز الأعمال" : "Top Picks"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {featuredBizs.map((biz) => (
                        <PublicBusinessCard key={biz.id} business={biz} featured />
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider between featured and rest */}
                {showFeatured && regularBizs.length > 0 && (
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-[#E2E8F0]" />
                    <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest">
                      {isAr ? "جميع الأعمال" : "All Businesses"}
                    </span>
                    <div className="flex-1 h-px bg-[#E2E8F0]" />
                  </div>
                )}

                {/* Main grid */}
                {regularBizs.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {regularBizs.map((biz) => (
                      <PublicBusinessCard key={biz.id} business={biz} />
                    ))}
                  </div>
                )}
              </div>

            ) : (
              /* ── Empty state ── */
              <div
                className="text-center py-20 rounded-3xl"
                style={{
                  background: "#FFFFFF",
                  border:     "1px solid #E2E8F0",
                  boxShadow:  "0 2px 12px rgba(15,23,42,0.05)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ background: "#F1F5F9" }}
                >
                  <Search size={22} className="text-[#94A3B8]" />
                </div>
                <h2
                  className="text-lg font-bold text-[#0F172A] mb-2"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {b.noResultsTitle}
                </h2>
                <p className="text-sm text-[#94A3B8] mb-7 max-w-xs mx-auto">
                  {b.noResultsSub}
                </p>
                <button
                  onClick={clearAll}
                  className="px-6 py-2.5 rounded-2xl text-sm font-bold text-[#3B82F6] transition-all duration-150"
                  style={{ border: "1.5px solid #3B82F6" }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "rgba(59,130,246,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    el.style.background = "transparent";
                  }}
                >
                  {b.showAll}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
