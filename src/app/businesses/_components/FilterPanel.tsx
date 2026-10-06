"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import type { DiscoveryQuery } from "@/lib/discovery/params";
import { RATING_FLOORS } from "@/lib/discovery/params";
import type { Facets } from "@/lib/discovery/search";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  query: DiscoveryQuery;
  facets: Facets;
  priceBounds: { min: number; max: number } | null;
  onChange: (patch: Partial<DiscoveryQuery>) => void;
}

/**
 * The filter column.
 *
 * It only reports what it is handed: a count of zero is shown rather
 * than hidden, because a dead end the visitor can see is better than
 * one they discover by tapping. Shown and also disabled — 33 of the 41
 * options here currently match nothing, and leaving them live meant 33
 * clickable rows that could only ever return an empty page.
 */
export default function FilterPanel({ query, facets, priceBounds, onChange }: Props) {
  // This panel is on the page twice: the desktop sidebar and the
  // filter drawer a phone opens. Hard-coded ids made both copies claim
  // the same ones, and a label resolves to the first match in document
  // order — so every price label in the drawer pointed at the sidebar's
  // input, which is display:none on a phone. Tapping the label focused
  // something invisible: no caret, no keyboard, nothing.
  const uid = useId();

  const { t, lang } = useLanguage();
  const f = t.filters;
  const isAr = lang === "ar";
  const name = (x: { nameAr: string; nameEn: string }) => (isAr ? x.nameAr : x.nameEn);

  const parent = facets.categories.find(
    (c) => c.slug === query.category || c.children.some((k) => k.slug === query.subcategory),
  );

  return (
    <div className="flex flex-col gap-7">

      {/* ── Quick toggles ── */}
      <Group title={f.quick}>
        <div className="flex flex-col gap-1">
          <Toggle
            label={f.openNow}
            checked={query.availability === "open-now"}
            onChange={(on) => onChange({ availability: on ? "open-now" : "any", page: 1 })}
          />
          <Toggle
            label={f.availableToday}
            checked={query.availability === "today"}
            onChange={(on) => onChange({ availability: on ? "today" : "any", page: 1 })}
          />
          <Toggle
            label={f.availableTomorrow}
            checked={query.availability === "tomorrow"}
            onChange={(on) => onChange({ availability: on ? "tomorrow" : "any", page: 1 })}
          />
          <Toggle
            label={f.verified}
            hint={f.verifiedHint}
            checked={query.verified}
            onChange={(on) => onChange({ verified: on, page: 1 })}
          />
          <Toggle
            label={f.instant}
            hint={f.instantHint}
            checked={query.instant}
            onChange={(on) => onChange({ instant: on, page: 1 })}
          />
          <Toggle
            label={f.online}
            checked={query.online}
            onChange={(on) => onChange({ online: on, page: 1 })}
          />
        </div>
      </Group>

      {/* ── Category, with its subcategories ── */}
      <Group title={f.category}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          <Row
            label={f.allCategories}
            active={!query.category && !query.subcategory}
            onClick={() => onChange({ category: "", subcategory: "", page: 1 })}
          />
          {facets.categories.map((c) => (
            <li key={c.id}>
              <Row
                label={name(c)}
                count={c.count}
                active={query.category === c.slug && !query.subcategory}
                onClick={() =>
                  onChange({
                    category: query.category === c.slug ? "" : c.slug,
                    subcategory: "",
                    page: 1,
                  })
                }
              />
              {/* Children appear once their parent is the active branch,
                  so the column does not open as a wall of options. */}
              {parent?.id === c.id && c.children.length > 0 && (
                <ul className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0 ps-3">
                  {c.children.map((k) => (
                    <li key={k.id}>
                      <Row
                        label={name(k)}
                        count={k.count}
                        active={query.subcategory === k.slug}
                        onClick={() =>
                          onChange({
                            category: c.slug,
                            subcategory: query.subcategory === k.slug ? "" : k.slug,
                            page: 1,
                          })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Group>

      {/* ── City, and its neighbourhoods once one is picked ── */}
      <Group title={f.city}>
        <ul className="m-0 flex max-h-72 list-none flex-col gap-0.5 overflow-y-auto p-0">
          <Row
            label={f.allCities}
            active={!query.city}
            onClick={() => onChange({ city: "", neighborhood: "", page: 1 })}
          />
          {facets.cities.map((c) => (
            <li key={c.id}>
              <Row
                label={name(c)}
                count={c.count}
                active={query.city === c.slug && !query.neighborhood}
                onClick={() =>
                  onChange({
                    city: query.city === c.slug ? "" : c.slug,
                    neighborhood: "",
                    page: 1,
                  })
                }
              />
            </li>
          ))}
        </ul>
      </Group>

      {facets.neighborhoods.length > 0 && (
        <Group title={f.neighborhood}>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            <Row
              label={f.allNeighborhoods}
              active={!query.neighborhood}
              onClick={() => onChange({ neighborhood: "", page: 1 })}
            />
            {facets.neighborhoods.map((n) => (
              <li key={n.id}>
                <Row
                  label={name(n)}
                  active={query.neighborhood === n.slug}
                  onClick={() =>
                    onChange({
                      neighborhood: query.neighborhood === n.slug ? "" : n.slug,
                      page: 1,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        </Group>
      )}

      {/* ── Price ── */}
      {priceBounds && (
        <Group title={f.price} hint={`${num(priceBounds.min, lang)} – ${num(priceBounds.max, lang)} ${t.businessCard.currency}`}>
          <div className="flex items-center gap-2">
            <NumberField
              id={`${uid}-min-price`}
              label={f.priceFrom}
              value={query.minPrice}
              placeholder={String(priceBounds.min)}
              onCommit={(v) => onChange({ minPrice: v, page: 1 })}
            />
            <span aria-hidden="true" className="mt-5 text-[var(--color-faint)]">—</span>
            <NumberField
              id={`${uid}-max-price`}
              label={f.priceTo}
              value={query.maxPrice}
              placeholder={String(priceBounds.max)}
              onCommit={(v) => onChange({ maxPrice: v, page: 1 })}
            />
          </div>
        </Group>
      )}

      {/* ── Rating ── */}
      <Group title={f.rating} hint={f.ratingHint}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          <Row
            label={f.anyRating}
            active={query.rating === null}
            onClick={() => onChange({ rating: null, page: 1 })}
          />
          {RATING_FLOORS.map((r) => (
            <li key={r}>
              <Row
                label={`${num(r, lang)}+`}
                active={query.rating === r}
                onClick={() => onChange({ rating: query.rating === r ? null : r, page: 1 })}
              />
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}

/* ─── Pieces ─────────────────────────────────────────────── */

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="m-0 mb-2.5 text-[0.8125rem] font-bold text-[var(--color-ink)]">
        {title}
        {hint && (
          <span className="ms-2 font-normal text-[var(--color-subtle)]">{hint}</span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  // An option matching nothing cannot be chosen — but one that is
  // already chosen stays live whatever its count, or a filter that
  // narrows to zero results would trap the visitor with no way back.
  const dead = count === 0 && !active;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={dead}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 text-start text-[0.875rem] transition-colors",
        active
          ? "bg-[var(--color-jade-soft)] font-bold text-[var(--color-ok)]"
          : dead
            ? "text-[var(--color-faint)]"
            : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="num shrink-0 text-[0.75rem] text-[var(--color-subtle)]">{count}</span>
      )}
    </button>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 transition-colors hover:bg-[var(--color-surface-2)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border transition-colors",
          checked
            ? "border-[var(--color-jade)] bg-[var(--color-jade)] text-[var(--color-inverse)]"
            : "border-[var(--color-line-2)] bg-[var(--color-surface)]",
        )}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[0.875rem]",
            checked ? "font-bold text-[var(--color-ink)]" : "text-[var(--color-muted)]",
          )}
        >
          {label}
        </span>
        {hint && (
          <span className="block truncate text-[0.6875rem] text-[var(--color-subtle)]">{hint}</span>
        )}
      </span>
    </label>
  );
}

/**
 * A price bound. Commits on blur and on Enter rather than on every
 * keystroke, so typing "250" does not fire three server round-trips.
 */
function NumberField({
  id,
  label,
  value,
  placeholder,
  onCommit,
}: {
  id: string;
  label: string;
  value: number | null;
  placeholder: string;
  onCommit: (v: number | null) => void;
}) {
  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return onCommit(null);
    const n = Number(trimmed);
    onCommit(Number.isFinite(n) && n >= 0 ? Math.round(n) : null);
  }

  return (
    <span className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1 block text-[0.6875rem] text-[var(--color-subtle)]">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        // Keyed on the committed value so an external reset (clear all,
        // or the back button) is reflected in the box.
        key={String(value)}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(e.currentTarget.value);
          }
        }}
        className="input num h-11 w-full"
      />
    </span>
  );
}
