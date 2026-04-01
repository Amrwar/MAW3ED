"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, MapPin } from "lucide-react";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import Container from "@/components/ui/Container";
import type { PublicBusiness } from "@/lib/data";

type Category = { id: string; slug: string; nameAr: string; icon: string };
type City     = { id: string; slug: string; nameAr: string };

interface Props {
  businesses:      PublicBusiness[];
  categories:      Category[];
  cities:          City[];
  initialQ:        string;
  initialCity:     string;
  initialCategory: string;
}

export default function BusinessesClient({
  businesses,
  categories,
  cities,
  initialQ,
  initialCity,
  initialCategory,
}: Props) {
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

  const selectedCat  = categories.find((c) => c.slug === category);
  const selectedCity = cities.find((c) => c.id === city);
  const hasFilters   = q || city || category;

  return (
    <div className="pb-16">
      {/* Sticky search + filter bar */}
      <div className="bg-white border-b border-[var(--color-border)] sticky top-16 z-30 py-4 shadow-sm">
        <Container>
          {/* Search row */}
          <form
            onSubmit={(e) => { e.preventDefault(); apply(q, city, category); }}
            className="flex flex-col sm:flex-row gap-3"
          >
            {/* Search input */}
            <div className="flex items-center gap-2 flex-1 bg-[var(--color-surface-2)] rounded-xl px-4 py-2.5 border border-[var(--color-border)] focus-within:border-[var(--color-accent)] transition-colors">
              <Search size={16} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن عمل أو خدمة..."
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-[var(--color-text-muted)]"
              />
              {q && (
                <button type="button" onClick={() => { setQ(""); apply("", city, category); }}>
                  <X size={14} className="text-[var(--color-text-muted)]" />
                </button>
              )}
            </div>

            {/* City select */}
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); apply(q, e.target.value, category); }}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm text-[var(--color-text-secondary)] outline-none focus:border-[var(--color-accent)] sm:w-44"
            >
              <option value="">كل المدن</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.nameAr}</option>
              ))}
            </select>

            <button type="submit" className="btn btn-accent px-6">
              بحث
            </button>
          </form>

          {/* Category chips */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => { setCategory(""); apply(q, city, ""); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                !category
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                  : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
              }`}
            >
              الكل
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.slug); apply(q, city, cat.slug); }}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  category === cat.slug
                    ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                    : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]"
                }`}
              >
                {cat.icon} {cat.nameAr}
              </button>
            ))}
          </div>
        </Container>
      </div>

      <Container className="py-8">
        {/* Browse by City — shown only when no filters active */}
        {!hasFilters && cities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              تصفح حسب المدينة
            </h2>
            <div className="flex flex-wrap gap-2">
              {cities.map((c) => (
                <Link
                  key={c.id}
                  href={`/cities/${c.slug}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                >
                  <MapPin size={13} />
                  {c.nameAr}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Results header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-[var(--color-text-primary)]">
              {selectedCat
                ? `${selectedCat.icon} ${selectedCat.nameAr}`
                : "تصفح الأعمال"}
              {selectedCity ? ` · ${selectedCity.nameAr}` : ""}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {isPending ? "جاري البحث..." : `${businesses.length} نتيجة`}
            </p>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setQ(""); setCity(""); setCategory(""); apply("", "", ""); }}
              className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1"
            >
              <X size={14} />
              مسح الفلاتر
            </button>
          )}
        </div>

        {/* Grid */}
        {businesses.length > 0 ? (
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-opacity duration-150 ${
              isPending ? "opacity-50" : "opacity-100"
            }`}
          >
            {businesses.map((b) => (
              <PublicBusinessCard key={b.id} business={b} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
              لم نجد نتائج
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              جرّب تغيير كلمة البحث أو الفلاتر
            </p>
            <button
              onClick={() => { setQ(""); setCity(""); setCategory(""); apply("", "", ""); }}
              className="btn btn-outline"
            >
              عرض كل الأعمال
            </button>
          </div>
        )}
      </Container>
    </div>
  );
}
