"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import Popover from "@/components/ui/Popover";
import Modal from "@/components/ui/Modal";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { DiscoveryQuery } from "@/lib/discovery/params";
import type { Facets } from "@/lib/discovery/search";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  CategoryOptions,
  CityOptions,
  Group,
  NeighborhoodOptions,
  PriceFields,
  RatingOptions,
  WhenOptions,
} from "./FilterPanel";

type Patch = (patch: Partial<DiscoveryQuery>) => void;
type Key = "category" | "city" | "when" | "price" | "rating";

/**
 * The Browse filter bar: one row under the search that stays in view.
 *
 * Each filter group is a pill that opens its own small panel — a
 * popover from 640px, a bottom sheet on a phone — and a pill with a
 * value set shows that value ("Clinics", "Today"), so the row says what
 * is narrowing the list without a second summary. The yes/no filters
 * are one-tap toggles at the end of the row.
 *
 * The row never wraps or squeezes: it scrolls sideways when the pills
 * outgrow it, and each label is capped and truncated, so nothing can
 * sit on top of anything else at any width or in either language.
 */
export default function FilterBar({
  query,
  facets,
  priceBounds,
  onChange,
  onOpenAll,
  activeCount,
}: {
  query: DiscoveryQuery;
  facets: Facets;
  priceBounds: { min: number; max: number } | null;
  onChange: Patch;
  /** Opens the sheet holding every filter (the phone's "Filters"). */
  onOpenAll: () => void;
  activeCount: number;
}) {
  const { t, lang } = useLanguage();
  const f = t.filters;
  const isAr = lang === "ar";
  const name = (x?: { nameAr: string; nameEn: string }) => (x ? (isAr ? x.nameAr : x.nameEn) : "");
  const asSheet = useMediaQuery("(max-width: 639.98px)");

  const [open, setOpen] = useState<Key | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // Stable, so the popover does not re-attach its listeners each render.
  const close = useCallback(() => setOpen(null), []);

  function toggle(key: Key, el: HTMLElement) {
    setAnchor(el);
    setOpen((cur) => (cur === key ? null : key));
  }

  /** A single choice closes its panel; there is nothing more to do in it. */
  const pickAndClose: Patch = (patch) => {
    onChange(patch);
    close();
  };

  // ── What each pill says when something is chosen ──
  // `category` may itself be a subcategory slug (the home page links
  // that way), and `subcategory` can come without its parent.
  const allSubs = facets.categories.flatMap((c) => c.children);
  const cat = facets.categories.find((c) => c.slug === query.category);
  const sub =
    allSubs.find((k) => k.slug === query.subcategory) ??
    (cat ? undefined : allSubs.find((k) => k.slug === query.category));
  const city = facets.cities.find((c) => c.slug === query.city);
  const hood = facets.neighborhoods.find((n) => n.slug === query.neighborhood);
  const whenLabel = {
    any: "",
    today: f.availableToday,
    tomorrow: f.availableTomorrow,
    "open-now": f.openNow,
  }[query.availability];
  const priceLabel =
    query.minPrice !== null && query.maxPrice !== null
      ? `${num(query.minPrice, lang)} – ${num(query.maxPrice, lang)}`
      : query.minPrice !== null
        ? `${f.priceFrom} ${num(query.minPrice, lang)}`
        : query.maxPrice !== null
          ? `${f.priceTo} ${num(query.maxPrice, lang)}`
          : "";

  const pills: { key: Key; title: string; value: string; body: ReactNode; width?: number }[] = [
    {
      key: "category",
      title: f.category,
      value: name(sub) || name(cat),
      body: <CategoryOptions query={query} facets={facets} onChange={pickAndClose} />,
    },
    {
      key: "city",
      title: f.city,
      value: name(hood) || name(city),
      body: (
        <div className="flex flex-col gap-5">
          {/* Stays open on a city: its neighbourhoods appear below once
              one is chosen, and closing would hide them. */}
          <CityOptions query={query} facets={facets} onChange={onChange} />
          {facets.neighborhoods.length > 0 && (
            <Group title={f.neighborhood}>
              <NeighborhoodOptions query={query} facets={facets} onChange={pickAndClose} />
            </Group>
          )}
        </div>
      ),
    },
    {
      key: "when",
      title: f.when,
      value: whenLabel,
      body: <WhenOptions query={query} onChange={pickAndClose} />,
    },
    ...(priceBounds
      ? [
          {
            key: "price" as const,
            title: f.price,
            value: priceLabel,
            width: 20,
            // Typing a range is two fields: stays open until Done.
            body: (
              <div className="flex flex-col gap-2 p-2">
                <p className="m-0 text-[0.75rem] text-[var(--color-subtle)]">
                  {num(priceBounds.min, lang)} – {num(priceBounds.max, lang)} {t.businessCard.currency}
                </p>
                <PriceFields query={query} priceBounds={priceBounds} onChange={onChange} />
              </div>
            ),
          },
        ]
      : []),
    {
      key: "rating",
      title: f.rating,
      value: query.rating !== null ? `${num(query.rating, lang)}+` : "",
      body: <RatingOptions query={query} onChange={pickAndClose} />,
    },
  ];

  const toggles = [
    { key: "verified", on: query.verified, label: f.verified, hint: f.verifiedHint },
    { key: "instant", on: query.instant, label: f.instant, hint: f.instantHint },
    { key: "online", on: query.online, label: f.online, hint: "" },
  ] as const;

  const current = pills.find((p) => p.key === open);

  const panelBody = current && (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">{current.body}</div>
      {current.key === "price" && (
        <div className="border-t border-[var(--color-line)] p-2">
          <button type="button" onClick={close} className="btn btn-primary btn-sm w-full">
            {f.done}
          </button>
        </div>
      )}
    </>
  );

  return (
    // Stays under the fixed header (h-20) while the results scroll.
    <div className="sticky top-20 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface)]/95 backdrop-blur-md">
      <div className="container-app">
        <div
          role="toolbar"
          aria-label={f.title}
          // A phone swipes one row sideways; from 768px the pills wrap
          // instead, since a sideways row is easy to miss with a mouse.
          className="filter-row flex items-center gap-2 overflow-x-auto py-3 md:flex-wrap md:overflow-visible"
        >
          {/* Every filter at once, on a phone: one tap to the full sheet.
              Hidden through a wrapper: .chip sets its own display, which
              beats a `hidden` utility on the button itself. */}
          <span className="flex shrink-0 sm:hidden">
          <button
            type="button"
            onClick={onOpenAll}
            className="chip chip-night"
          >
            <SlidersHorizontal size={14} strokeWidth={2} aria-hidden="true" />
            {f.title}
            {activeCount > 0 && (
              <span className="num rounded-full bg-[var(--color-jade)] px-1.5 text-[0.6875rem] font-bold">
                {activeCount}
              </span>
            )}
          </button>
          </span>

          {pills.map((p) => {
            const set = !!p.value;
            const isOpen = open === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                onClick={(e) => toggle(p.key, e.currentTarget)}
                className={cn("chip shrink-0", set ? "chip-jade" : isOpen && "chip-open")}
              >
                {/* Capped and truncated: a long city or specialty name
                    shortens rather than pushing into its neighbour. */}
                <span className="max-w-[10rem] truncate">{set ? p.value : p.title}</span>
                <ChevronDown
                  size={14}
                  strokeWidth={2.2}
                  aria-hidden="true"
                  className={cn("shrink-0 transition-transform", isOpen && "rotate-180")}
                />
              </button>
            );
          })}

          <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-[var(--color-line)] md:hidden" />

          {toggles.map((tg) => (
            <button
              key={tg.key}
              type="button"
              aria-pressed={tg.on}
              title={tg.hint || undefined}
              onClick={() => onChange({ [tg.key]: !tg.on, page: 1 })}
              className={cn("chip shrink-0", tg.on && "chip-jade")}
            >
              {tg.on && <Check size={13} strokeWidth={2.6} aria-hidden="true" />}
              {tg.label}
            </button>
          ))}
        </div>
      </div>

      {current &&
        (asSheet ? (
          <Modal open onClose={close} variant="sheet" title={current.title}>
            {current.body}
            {current.key === "price" && (
              <button type="button" onClick={close} className="btn btn-primary mt-5 w-full">
                {f.done}
              </button>
            )}
          </Modal>
        ) : (
          <Popover open onClose={close} anchor={anchor} label={current.title} width={current.width ?? 17}>
            {panelBody}
          </Popover>
        ))}
    </div>
  );
}
