"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, X, MapPin, CalendarDays, SlidersHorizontal, Store } from "lucide-react";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import PageHero from "@/components/shared/PageHero";
import EmptyState from "@/components/ui/EmptyState";
import type { PublicBusiness } from "@/lib/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { num } from "@/lib/fmt";

type Category = { id: string; slug: string; nameAr: string; nameEn: string; icon: string };
type City     = { id: string; slug: string; nameAr: string; nameEn: string };

interface Props {
  businesses:      PublicBusiness[];
  categories:      Category[];
  cities:          City[];
  initialQ:        string;
  initialCity:     string;
  initialCategory: string;
  /** "today" | "tomorrow" | "" — carried over from the hero. */
  initialWhen:     string;
}

/** One filter row in the sidebar. */
function FilterItem({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-start text-[0.875rem] transition-colors",
          active
            ? "bg-[var(--color-jade-soft)] font-bold text-[var(--color-ok)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
        )}
      >
        {label}
      </button>
    </li>
  );
}

export default function BusinessesClient({
  businesses,
  categories,
  cities,
  initialQ,
  initialCity,
  initialCategory,
  initialWhen,
}: Props) {
  const { t, lang } = useLanguage();
  const b = t.businesses;
  const isAr = lang === "ar";

  const router = useRouter();
  const [isPending, startTx] = useTransition();
  const [q, setQ] = useState(initialQ);
  const [city, setCity] = useState(initialCity);
  const [category, setCategory] = useState(initialCategory);
  const [when, setWhen] = useState(initialWhen);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function apply(nQ: string, nCity: string, nCat: string, nWhen: string = when) {
    const p = new URLSearchParams();
    if (nQ) p.set("q", nQ);
    if (nCity) p.set("city", nCity);
    if (nCat) p.set("category", nCat);
    if (nWhen) p.set("when", nWhen);
    startTx(() => router.push(`/businesses${p.size ? `?${p}` : ""}`));
  }

  function clearAll() {
    setQ("");
    setCity("");
    setCategory("");
    setWhen("");
    apply("", "", "", "");
  }

  const getName = (item: Category | City) =>
    lang === "en" ? item.nameEn || item.nameAr : item.nameAr;

  const selectedCat = categories.find((c) => c.slug === category);
  const selectedCity = cities.find((c) => c.id === city);
  const hasFilters = !!(q || city || category || when);

  const copy = {
    filters:   isAr ? "الفلاتر"        : "Filters",
    cities:    isAr ? "المدينة"        : "City",
    cats:      isAr ? "الفئة"          : "Category",
    allCities: b.allCities,
    allCats:   b.allCategories,
    heroSub:   isAr
      ? "ابحث وأحجز من أفضل الأنشطة والخدمات في منطقتك"
      : "Search and book from the best businesses near you",
    when:      isAr ? "اليوم"    : "Day",
    whenAny:   isAr ? "أي وقت"   : "Any time",
    whenToday: isAr ? "النهارده" : "Today",
    whenTomorrow: isAr ? "بكرة"  : "Tomorrow",
  };

  const whenLabel =
    when === "today" ? copy.whenToday : when === "tomorrow" ? copy.whenTomorrow : "";

  /** Chips for the filters currently applied. */
  const appliedChips = [
    q && { key: "q", label: q, clear: () => { setQ(""); apply("", city, category); } },
    selectedCity && {
      key: "city",
      label: getName(selectedCity),
      clear: () => { setCity(""); apply(q, "", category); },
    },
    selectedCat && {
      key: "cat",
      label: getName(selectedCat),
      clear: () => { setCategory(""); apply(q, city, ""); },
    },
    whenLabel && {
      key: "when",
      label: whenLabel,
      clear: () => { setWhen(""); apply(q, city, category, ""); },
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  return (
    <div className="bg-[var(--color-ground)]">

      <PageHero badge={isAr ? "اكتشف" : "Discover"} title={b.pageTitle} subtitle={copy.heroSub} />

      {/* ── Search bar ── */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="container-app py-5">
          <form
            onSubmit={(e) => { e.preventDefault(); apply(q, city, category); }}
            className="flex flex-wrap items-center gap-3"
          >
            <div className="flex flex-[1_1_16rem] min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-ground)] px-4 h-13 min-h-12">
              <Search size={18} strokeWidth={1.8} className="shrink-0 text-[var(--color-subtle)]" aria-hidden="true" />
              <label htmlFor="browse-q" className="sr-only-label">{b.searchPlaceholder}</label>
              <input
                id="browse-q"
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={b.searchPlaceholder}
                className="field-fill w-full min-w-0 border-0 bg-transparent text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
              />
            </div>

            <div className="flex flex-[0_1_13rem] min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-ground)] px-4 min-h-12">
              <MapPin size={17} strokeWidth={1.8} className="shrink-0 text-[var(--color-subtle)]" aria-hidden="true" />
              <label htmlFor="browse-city" className="sr-only-label">{copy.cities}</label>
              <select
                id="browse-city"
                value={city}
                onChange={(e) => { setCity(e.target.value); apply(q, e.target.value, category); }}
                className="field-fill w-full min-w-0 border-0 bg-transparent text-[0.9375rem] text-[var(--color-ink)] outline-none"
              >
                <option value="">{copy.allCities}</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{getName(c)}</option>
                ))}
              </select>
            </div>

            {/* Carried over from the hero, and adjustable here so the
                filter is never applied invisibly. */}
            <div className="flex flex-[0_1_11rem] min-w-0 items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-ground)] px-4 min-h-12">
              <CalendarDays size={17} strokeWidth={1.8} className="shrink-0 text-[var(--color-subtle)]" aria-hidden="true" />
              <label htmlFor="browse-when" className="sr-only-label">{copy.when}</label>
              <select
                id="browse-when"
                value={when}
                onChange={(e) => { setWhen(e.target.value); apply(q, city, category, e.target.value); }}
                className="field-fill w-full min-w-0 border-0 bg-transparent text-[0.9375rem] text-[var(--color-ink)] outline-none"
              >
                <option value="">{copy.whenAny}</option>
                <option value="today">{copy.whenToday}</option>
                <option value="tomorrow">{copy.whenTomorrow}</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary shrink-0" disabled={isPending}>
              {isPending ? b.searching : b.searchBtn}
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className="btn btn-outline shrink-0 lg:hidden"
            >
              <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
              {copy.filters}
            </button>
          </form>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="container-app flex flex-wrap items-start gap-8 py-10">

        {/* Filters */}
        <aside
          className={cn(
            "flex-[0_1_17rem] min-w-[15rem] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6",
            !filtersOpen && "hidden lg:block",
          )}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="m-0 text-base font-bold text-[var(--color-ink)]">{copy.filters}</h2>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[0.78125rem] font-bold text-[var(--color-jade)]"
              >
                {b.clearFilters}
              </button>
            )}
          </div>

          <div className="mb-6">
            <h3 className="section-eyebrow mb-3 block">{copy.cats}</h3>
            <ul className="flex flex-col gap-0.5">
              <FilterItem
                active={!category}
                label={copy.allCats}
                onClick={() => { setCategory(""); apply(q, city, ""); }}
              />
              {categories.map((c) => (
                <FilterItem
                  key={c.id}
                  active={category === c.slug}
                  label={getName(c)}
                  onClick={() => { setCategory(c.slug); apply(q, city, c.slug); }}
                />
              ))}
            </ul>
          </div>

          <div>
            <h3 className="section-eyebrow mb-3 block">{copy.cities}</h3>
            <ul className="flex max-h-[18rem] flex-col gap-0.5 overflow-y-auto">
              <FilterItem
                active={!city}
                label={copy.allCities}
                onClick={() => { setCity(""); apply(q, "", category); }}
              />
              {cities.map((c) => (
                <FilterItem
                  key={c.id}
                  active={city === c.id}
                  label={getName(c)}
                  onClick={() => { setCity(c.id); apply(q, c.id, category); }}
                />
              ))}
            </ul>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-[999_1_34rem] min-w-0">

          <div className="mb-5 flex flex-wrap items-center gap-4">
            <p className="m-0 text-sm text-[var(--color-subtle)]">
              <strong className="num text-[var(--color-ink)]">{num(businesses.length, lang)}</strong>{" "}
              {b.results}
            </p>
            {appliedChips.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {appliedChips.map((chip) => (
                  <li key={chip.key}>
                    <button type="button" onClick={chip.clear} className="chip chip-jade">
                      {chip.label}
                      <X size={12} strokeWidth={2.4} aria-hidden="true" />
                      <span className="sr-only-label">{b.clearFilters}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {businesses.length === 0 ? (
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)]">
              <EmptyState
                icon={<Store size={24} strokeWidth={1.7} />}
                title={b.noResultsTitle}
                body={b.noResultsSub}
                action={
                  <button type="button" onClick={clearAll} className="btn btn-primary btn-sm">
                    {b.showAll}
                  </button>
                }
              />
            </div>
          ) : (
            <ul
              className={cn(
                "grid gap-5 sm:grid-cols-2 xl:grid-cols-3",
                isPending && "opacity-60 transition-opacity",
              )}
            >
              {businesses.map((biz) => (
                <li key={biz.id} className="min-w-0">
                  <PublicBusinessCard business={biz} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
