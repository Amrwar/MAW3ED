"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, useId } from "react";
import { countText } from "@/lib/i18n";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, Store, X } from "lucide-react";
import BusinessCard, { BusinessCardSkeleton } from "@/components/shared/BusinessCard";
import PageHero from "@/components/shared/PageHero";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import {
  PAGE_SIZE,
  SORTS,
  buildDiscoveryParams,
  discoveryHref,
  hasActiveFilters,
  parseDiscoveryQuery,
  type DiscoveryQuery,
  type Sort,
} from "@/lib/discovery/params";
import type { DiscoveryBusiness, Facets } from "@/lib/discovery/search";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import FilterPanel from "./FilterPanel";
import PaginationBar from "./PaginationBar";

interface Props {
  query: DiscoveryQuery;
  businesses: DiscoveryBusiness[];
  total: number;
  pageCount: number;
  facets: Facets;
  priceBounds: { min: number; max: number } | null;
}

/**
 * The listing.
 *
 * The URL is the state. Every control writes to it and the server
 * re-renders from it, so a refresh keeps the filters, the back button
 * steps through them, and a link carries them. Nothing is held in a
 * second copy here that could drift from the address bar.
 *
 * The one exception is the mobile "load more" pile, which appends pages
 * onto the end of the list for scrolling. It still bumps ?page, so the
 * address stays shareable and the SEO pagination stays intact.
 */
export default function BusinessesClient({
  query,
  businesses,
  total,
  pageCount,
  facets,
  priceBounds,
}: Props) {
  const { t, lang } = useLanguage();
  const b = t.businesses;
  const f = t.filters;
  const isAr = lang === "ar";

  // Not a literal. While the page streams, React holds the resolved
  // markup in a hidden div before swapping it in, so for that window
  // the id exists twice — and label[for] takes the first match in
  // document order, which is the hidden copy. Clicking the search
  // label in that window focused nothing.
  const uid = useId();

  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [term, setTerm] = useState(query.q);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Pages appended by "load more", keyed by the filters they belong to,
  // so changing a filter drops them rather than mixing two result sets.
  const filterKey = useMemo(
    () => buildDiscoveryParams({ ...query, page: 1 }).toString(),
    [query],
  );
  const [extra, setExtra] = useState<{ key: string; items: DiscoveryBusiness[] }>({
    key: filterKey,
    items: [],
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // The search box follows the URL, so the back button restores the term.
  // Held in state, not a ref: React may not read refs during render.
  const [lastQ, setLastQ] = useState(query.q);
  if (lastQ !== query.q) {
    setLastQ(query.q);
    setTerm(query.q);
  }

  useEffect(() => {
    setExtra((prev) => (prev.key === filterKey ? prev : { key: filterKey, items: [] }));
    setLoadError(false);
  }, [filterKey]);

  const push = useCallback(
    (patch: Partial<DiscoveryQuery>) => {
      const next = { ...query, ...patch };
      startTransition(() => router.push(discoveryHref(next), { scroll: false }));
    },
    [query, router],
  );

  const appended = extra.key === filterKey ? extra.items : [];
  const shown = [...businesses, ...appended];
  const loadedThrough = query.page + Math.ceil(appended.length / PAGE_SIZE);
  const canLoadMore = loadedThrough < pageCount;

  async function loadMore() {
    setLoadingMore(true);
    setLoadError(false);
    try {
      const params = buildDiscoveryParams({ ...query, page: loadedThrough + 1 });
      const res = await fetch(`/api/public/businesses?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { businesses?: DiscoveryBusiness[] };
      setExtra((prev) => ({
        key: filterKey,
        items: [...(prev.key === filterKey ? prev.items : []), ...(data.businesses ?? [])],
      }));
    } catch {
      setLoadError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  /** Removable summary of everything currently narrowing the list. */
  const chips: { key: string; label: string; clear: () => void }[] = [];
  const nameOf = (x?: { nameAr: string; nameEn: string }) =>
    x ? (isAr ? x.nameAr : x.nameEn) : "";

  if (query.q) chips.push({ key: "q", label: query.q, clear: () => push({ q: "", page: 1 }) });

  const cat = facets.categories.find((c) => c.slug === query.category);
  const sub = cat?.children.find((k) => k.slug === query.subcategory);
  if (sub) {
    chips.push({ key: "sub", label: nameOf(sub), clear: () => push({ subcategory: "", page: 1 }) });
  } else if (cat) {
    chips.push({
      key: "cat",
      label: nameOf(cat),
      clear: () => push({ category: "", subcategory: "", page: 1 }),
    });
  }

  const hood = facets.neighborhoods.find((n) => n.slug === query.neighborhood);
  const city = facets.cities.find((c) => c.slug === query.city);
  if (hood) {
    chips.push({ key: "hood", label: nameOf(hood), clear: () => push({ neighborhood: "", page: 1 }) });
  }
  if (city) {
    chips.push({
      key: "city",
      label: nameOf(city),
      clear: () => push({ city: "", neighborhood: "", page: 1 }),
    });
  }

  if (query.minPrice !== null || query.maxPrice !== null) {
    const lo = query.minPrice !== null ? num(query.minPrice, lang) : "";
    const hi = query.maxPrice !== null ? num(query.maxPrice, lang) : "";
    chips.push({
      key: "price",
      label: lo && hi ? `${lo} – ${hi}` : lo ? `${f.priceFrom} ${lo}` : `${f.priceTo} ${hi}`,
      clear: () => push({ minPrice: null, maxPrice: null, page: 1 }),
    });
  }

  if (query.rating !== null) {
    chips.push({
      key: "rating",
      label: `${num(query.rating, lang)}+`,
      clear: () => push({ rating: null, page: 1 }),
    });
  }

  if (query.availability !== "any") {
    const label = {
      today: f.availableToday,
      tomorrow: f.availableTomorrow,
      "open-now": f.openNow,
    }[query.availability];
    chips.push({
      key: "avail",
      label,
      clear: () => push({ availability: "any", page: 1 }),
    });
  }

  for (const [key, on, label] of [
    ["verified", query.verified, f.verified],
    ["instant", query.instant, f.instant],
    ["online", query.online, f.online],
  ] as const) {
    if (on) chips.push({ key, label, clear: () => push({ [key]: false, page: 1 }) });
  }

  const filterCount = chips.length;
  const panel = (
    <FilterPanel query={query} facets={facets} priceBounds={priceBounds} onChange={push} />
  );

  return (
    <div className="bg-[var(--color-ground)]">
      <PageHero
        badge={isAr ? "اكتشف" : "Discover"}
        title={b.pageTitle}
        subtitle={isAr ? "ابحث واحجز من الأنشطة المتاحة في منطقتك" : "Search and book from the businesses listed near you"}
      />

      {/* ── Search bar ── */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <div className="container-app py-5">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              push({ q: term.trim(), page: 1 });
            }}
            className="flex flex-wrap items-center gap-3"
          >
            <label
              htmlFor={`${uid}-q`}
              className="flex min-h-12 flex-[1_1_18rem] cursor-text items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-ground)] px-4 focus-within:ring-2 focus-within:ring-[var(--color-jade)]"
            >
              <Search size={18} strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-[var(--color-subtle)]" />
              <input
                id={`${uid}-q`}
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={b.searchPlaceholder}
                className="w-full min-w-0 border-0 bg-transparent text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
              />
            </label>

            <button type="submit" className="btn btn-primary shrink-0" disabled={isPending}>
              {isPending ? b.searching : b.searchBtn}
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="btn btn-outline shrink-0 lg:hidden"
            >
              <SlidersHorizontal size={16} strokeWidth={1.8} aria-hidden="true" />
              {f.title}
              {filterCount > 0 && (
                <span className="num rounded-full bg-[var(--color-jade)] px-1.5 text-[0.6875rem] font-bold text-[var(--color-inverse)]">
                  {filterCount}
                </span>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="container-app flex flex-wrap items-start gap-8 py-10">

        <aside className="hidden w-[16rem] shrink-0 lg:block">{panel}</aside>

        <div className="min-w-0 flex-1">

          {/* Count, applied chips and sort */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <p className="m-0 text-[0.875rem] text-[var(--color-muted)]" aria-live="polite">
              <strong className="font-bold text-[var(--color-ink)]">{countText(lang, total, b.resultsLabel)}</strong>
            </p>

            <label className="ms-auto flex min-h-11 shrink-0 items-center gap-2 text-[0.8125rem] text-[var(--color-subtle)]">
              {t.sorts.label}
              <select
                value={query.sort}
                onChange={(e) => push({ sort: e.target.value as Sort, page: 1 })}
                className="select h-11 w-auto min-w-[9rem]"
              >
                {SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t.sorts.options[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button key={c.key} type="button" onClick={c.clear} className="chip chip-jade">
                  {c.label}
                  <X size={13} strokeWidth={2.4} aria-hidden="true" />
                </button>
              ))}
              {hasActiveFilters(query) && (
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => router.push(pathname, { scroll: false }))
                  }
                  className="min-h-11 px-2 text-[0.8125rem] font-bold text-[var(--color-jade)] underline-offset-4 hover:underline"
                >
                  {f.clearAll}
                </button>
              )}
            </div>
          )}

          {/* The grid, dimmed rather than replaced while a new page
              loads — the old results stay readable and nothing jumps. */}
          {shown.length === 0 ? (
            isPending ? (
              <ResultSkeleton />
            ) : (
              <div className="card">
                <EmptyState
                  icon={<Store size={24} strokeWidth={1.7} />}
                  title={hasActiveFilters(query) ? b.emptyFiltered : b.emptyAll}
                  body={hasActiveFilters(query) ? b.emptyFilteredBody : b.emptyAllBody}
                  action={
                    hasActiveFilters(query) ? (
                      <button
                        type="button"
                        onClick={() => startTransition(() => router.push(pathname))}
                        className="btn btn-primary btn-sm"
                      >
                        {f.clearAll}
                      </button>
                    ) : (
                      <Link href="/signup" className="btn btn-primary btn-sm">
                        {t.featured.emptyAction}
                      </Link>
                    )
                  }
                />
              </div>
            )
          ) : (
            <>
              {/* The filter groups are the page's h2s; the results had
                  no heading at all, so the card h3s hung off the h1. */}
              <h2 className="sr-only-label">{isAr ? "نتائج البحث" : "Search results"}</h2>

              <ul
                className={cn(
                  "m-0 grid list-none grid-cols-1 gap-5 p-0 transition-opacity sm:grid-cols-2 xl:grid-cols-3",
                  isPending && "opacity-60",
                )}
              >
                {shown.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <BusinessCard business={item} />
                  </li>
                ))}
              </ul>

              {loadError && (
                <div className="mt-6">
                  <Alert tone="danger" >{b.loadMoreError}</Alert>
                </div>
              )}

              {/* Phones get "load more"; desktop gets numbered pages.
                  Both move through the same ?page URLs. */}
              {canLoadMore && (
                <div className="mt-8 lg:hidden">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="btn btn-outline w-full"
                  >
                    {loadingMore ? b.loadingMore : b.loadMore}
                  </button>
                </div>
              )}

              {pageCount > 1 && (
                <div className="mt-10 hidden lg:block">
                  <PaginationBar
                    page={query.page}
                    pageCount={pageCount}
                    hrefFor={(p) => discoveryHref({ ...query, page: p })}
                    onNavigate={(p) => push({ page: p })}
                  />
                </div>
              )}

              {/* Crawlable rel links, so the pages beyond the first are
                  reachable without running the filter JavaScript. */}
              <nav aria-label={b.pagination} className="sr-only">
                {query.page > 1 && (
                  <a href={discoveryHref({ ...query, page: query.page - 1 })} rel="prev">
                    {b.previous}
                  </a>
                )}
                {query.page < pageCount && (
                  <a href={discoveryHref({ ...query, page: query.page + 1 })} rel="next">
                    {b.next}
                  </a>
                )}
              </nav>
            </>
          )}
        </div>
      </div>

      {/* ── Filters on a phone ── */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        variant="sheet"
        title={f.title}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(false);
                startTransition(() => router.push(pathname, { scroll: false }));
              }}
              className="btn btn-outline flex-1"
            >
              {f.clearAll}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="btn btn-primary flex-[2]"
            >
              {countText(lang, total, f.showResults)}
            </button>
          </div>
        }
      >
        {panel}
      </Modal>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <BusinessCardSkeleton />
        </li>
      ))}
    </ul>
  );
}

/** Re-exported so the server page can hand it the parsed query. */
export { parseDiscoveryQuery };
