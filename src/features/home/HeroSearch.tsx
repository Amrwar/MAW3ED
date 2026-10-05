"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, CalendarDays, BadgeCheck, Zap, Wallet } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

type City = { id: string; slug: string; nameAr: string; nameEn: string };
type Category = { slug: string; nameAr: string; nameEn: string };

interface Props {
  cities: City[];
  /** Shown as one-tap shortcuts under the field. Already count-ordered. */
  suggestions: Category[];
  /**
   * Remembered city, read from the cookie on the server so the first
   * paint already has it and nothing flashes.
   */
  initialCity?: string;
}

/**
 * The hero is the search. Everything above it is one line of context,
 * because a visitor who lands here wants to find a barber in Nasr
 * City, not read about the platform.
 *
 * Three questions, in the order a person asks them: what, where, when.
 * All three post to /businesses, which is the one search the app has
 * — the hero does not run a second one of its own.
 */
export default function HeroSearch({ cities, suggestions, initialCity = "" }: Props) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const h = t.hero;
  const isAr = lang === "ar";

  const [query, setQuery] = useState("");
  const [city, setCity] = useState(initialCity);
  const [when, setWhen] = useState<"any" | "today" | "tomorrow">("any");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    if (when !== "any") params.set("when", when);

    // Remembering the city is what lets the homepage show listings
    // near the visitor next time. A year, same as the language.
    if (city) document.cookie = `maw3ed-city=${city};path=/;max-age=31536000;samesite=lax`;

    startTransition(() => {
      router.push(`/businesses${params.size ? `?${params}` : ""}`);
    });
  }

  function jumpTo(slug: string) {
    startTransition(() => router.push(`/categories/${slug}`));
  }

  const whenOptions: { value: typeof when; label: string }[] = [
    { value: "any", label: h.whenAny },
    { value: "today", label: h.whenToday },
    { value: "tomorrow", label: h.whenTomorrow },
  ];

  const promises = [
    { Icon: Zap, text: h.promiseInstant },
    { Icon: BadgeCheck, text: h.promiseVerified },
    { Icon: Wallet, text: h.promiseFree },
  ];

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app py-12 lg:py-20">
        <div className="mx-auto flex max-w-[52rem] flex-col items-center text-center">

          <h1 className="display-title text-balance">
            {h.title}{" "}
            <span className="font-extrabold text-[var(--color-jade)]">{h.titleAccent}</span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[1.0625rem] leading-[1.75] text-[var(--color-muted)]">
            {h.subtitle}
          </p>

          {/* ── Search ──────────────────────────────────────────
              One card on desktop, a stack of full-width fields on a
              phone: a 3-up row at 390px leaves each field about
              100px, which is unusable. */}
          <form
            onSubmit={submit}
            role="search"
            aria-label={h.searchAria}
            className={cn(
              "mt-9 w-full rounded-[var(--radius-xl)] border border-[var(--color-line)]",
              "bg-[var(--color-surface)] p-2.5 text-start shadow-[var(--shadow-raised)]",
              "flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0",
            )}
          >
            {/* What. The whole cell is the label, so the tap target is
                the full block rather than the 28px line of text in it. */}
            <label
              htmlFor="hero-q"
              className="flex min-h-14 min-w-0 flex-1 cursor-text items-center gap-3 rounded-[var(--radius-md)] px-3.5 transition-colors hover:bg-[var(--color-surface-2)] focus-within:bg-[var(--color-surface-2)] focus-within:ring-2 focus-within:ring-[var(--color-jade)]"
            >
              <Search
                size={18}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-[var(--color-subtle)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.6875rem] font-bold text-[var(--color-subtle)]">
                  {h.whatLabel}
                </span>
                <input
                  id="hero-q"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={h.whatPlaceholder}
                  autoComplete="off"
                  className="h-7 w-full min-w-0 border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
                />
              </span>
            </label>

            <FieldDivider />

            {/* Where */}
            <label
              htmlFor="hero-city"
              className="flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3.5 transition-colors hover:bg-[var(--color-surface-2)] focus-within:bg-[var(--color-surface-2)] focus-within:ring-2 focus-within:ring-[var(--color-jade)] md:flex-[0_1_14rem]"
            >
              <MapPin
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-[var(--color-subtle)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.6875rem] font-bold text-[var(--color-subtle)]">
                  {h.whereLabel}
                </span>
                <select
                  id="hero-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-7 w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none"
                >
                  <option value="">{h.whereAny}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {isAr ? c.nameAr : c.nameEn}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <FieldDivider />

            {/* When */}
            <label
              htmlFor="hero-when"
              className="flex min-h-14 min-w-0 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-3.5 transition-colors hover:bg-[var(--color-surface-2)] focus-within:bg-[var(--color-surface-2)] focus-within:ring-2 focus-within:ring-[var(--color-jade)] md:flex-[0_1_11rem]"
            >
              <CalendarDays
                size={17}
                strokeWidth={1.8}
                aria-hidden="true"
                className="shrink-0 text-[var(--color-subtle)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.6875rem] font-bold text-[var(--color-subtle)]">
                  {h.whenLabel}
                </span>
                <select
                  id="hero-when"
                  value={when}
                  onChange={(e) => setWhen(e.target.value as typeof when)}
                  className="h-7 w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none"
                >
                  {whenOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <button
              type="submit"
              disabled={pending}
              className="btn btn-primary shrink-0 md:ms-2.5 md:self-stretch"
            >
              {pending ? h.searching : h.searchBtn}
            </button>
          </form>

          {/* One-tap shortcuts into the categories that actually have
              listings. Nothing is shown when none do. */}
          {suggestions.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[0.8125rem] text-[var(--color-subtle)]">{h.tryLabel}</span>
              {suggestions.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => jumpTo(c.slug)}
                  className="chip"
                >
                  {isAr ? c.nameAr : c.nameEn}
                </button>
              ))}
            </div>
          )}

          {/* What the platform guarantees — not how many people use it. */}
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            {promises.map(({ Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-[0.84375rem] text-[var(--color-muted)]"
              >
                <Icon
                  size={15}
                  strokeWidth={1.9}
                  aria-hidden="true"
                  className="shrink-0 text-[var(--color-jade)]"
                />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** Hairline between fields — a horizontal rule once they stack. */
function FieldDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-3.5 h-px shrink-0 bg-[var(--color-line)] md:mx-0 md:my-2 md:h-auto md:w-px"
    />
  );
}
