"use client";

import { useMemo, useState } from "react";
import Tabs from "@/components/ui/Tabs";
import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight, MapPin, Store } from "lucide-react";
import BusinessCard from "@/components/shared/BusinessCard";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import type { PublicBusiness } from "@/lib/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  businesses: PublicBusiness[];
  /** The city the visitor last picked, in the page's language. */
  cityName?: string;
  viewAllHref: string;
}

const ALL = "";
const SHOWN = 3;

/**
 * The visitor's own city, in one white panel on the page's ground: the
 * heading and the way out on one side, the places on the other.
 *
 * The area tabs are the neighbourhoods of the places shown, and only
 * appear when there are at least two of them to choose between.
 */
export default function NearbyPanel({ businesses, cityName, viewAllHref }: Props) {
  const { t, lang } = useLanguage();
  const f = t.featured;
  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;
  const [area, setArea] = useState(ALL);

  const areas = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of businesses) {
      if (b.neighborhood && !seen.has(b.neighborhood.slug)) {
        seen.set(b.neighborhood.slug, lang === "ar" ? b.neighborhood.nameAr : b.neighborhood.nameEn);
      }
    }
    return [...seen].map(([slug, name]) => ({ slug, name }));
  }, [businesses, lang]);

  // A choice left over from an earlier list (a refresh, another city)
  // falls back to every area rather than filtering down to nothing.
  const active = areas.some((a) => a.slug === area) ? area : ALL;
  // One row of three: the panel is a taste of the city; the link below
  // goes to the rest, narrowed to the chosen area when there is one.
  const shown = (active === ALL ? businesses : businesses.filter((b) => b.neighborhood?.slug === active)).slice(0, SHOWN);
  const allHref = active === ALL ? viewAllHref : `${viewAllHref}&neighborhood=${encodeURIComponent(active)}`;
  const where = areas.find((a) => a.slug === active)?.name ?? cityName;

  /** The hero's own city select, further up this page: brought into view and focused. */
  function changeCity() {
    const select = document.getElementById("hero-city");
    if (!select) return;
    select.scrollIntoView({ behavior: "smooth", block: "center" });
    select.focus({ preventScroll: true });
  }

  return (
    <section className="bg-[var(--color-ground)] py-20">
      <div className="container-app">
        <div className="grid gap-10 rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-raised)] sm:p-9 xl:grid-cols-[17rem_minmax(0,1fr)] xl:gap-0">

          <div className="flex min-w-0 flex-col xl:border-e xl:border-[var(--color-line)] xl:pe-9">
            <span
              aria-hidden="true"
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)] text-[var(--color-jade)]"
            >
              <MapPin size={21} strokeWidth={1.8} />
            </span>
            <span className="section-eyebrow">{f.nearbyEyebrow}</span>
            <h2 className="section-title mt-2.5">
              {cityName ? `${f.nearbyTitle} — ${cityName}` : f.nearbyTitle}
            </h2>
            <p className="mt-3 text-[0.875rem] text-[var(--color-subtle)]">{f.nearbyNote}</p>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 xl:mt-auto xl:flex-col xl:items-start xl:pt-10">
              {businesses.length > 0 && (
                <Link href={allHref} className="btn btn-outline btn-pill btn-sm">
                  {where ? f.nearbyAllIn.replace("{city}", where) : f.viewAll}
                  <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
                </Link>
              )}
              <button
                type="button"
                onClick={changeCity}
                className="inline-flex min-h-11 items-center text-[0.875rem] font-bold text-[var(--color-jade)] hover:text-[var(--color-jade-hover)]"
              >
                {f.changeCity}
              </button>
            </div>
          </div>

          <div className="min-w-0 xl:ps-9">
            {businesses.length === 0 ? (
              <EmptyState
                icon={<Store size={24} strokeWidth={1.7} />}
                title={f.nearbyEmptyTitle}
                body={f.nearbyEmptyBody}
                action={
                  <Link href="/businesses" className="btn btn-primary btn-sm">
                    {f.viewAll}
                  </Link>
                }
              />
            ) : (
              <>
                {areas.length >= 2 && (
                  <Tabs
                    variant="underline"
                    label={f.areasLabel}
                    value={active}
                    onChange={setArea}
                    items={[{ value: ALL, label: f.allAreas }, ...areas.map((a) => ({ value: a.slug, label: a.name }))]}
                    className="mb-6 overflow-x-auto"
                  />
                )}

                {/* Sideways on phones, one card and a bit of the next in
                    view; a grid from md. */}
                <ul className="-mx-6 flex list-none snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-3 sm:-mx-9 sm:scroll-px-9 sm:px-9 md:mx-0 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-3">
                  {shown.map((b) => (
                    <li key={b.id} className="w-[82%] min-w-0 shrink-0 snap-start sm:w-[60%] md:w-auto">
                      <BusinessCard business={b} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function NearbyPanelSkeleton() {
  return (
    <section className="bg-[var(--color-ground)] py-20" aria-hidden="true">
      <div className="container-app">
        <div className="grid gap-10 rounded-[var(--radius-2xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-9 xl:grid-cols-[17rem_minmax(0,1fr)]">
          <div>
            <Skeleton className="h-12 w-12" rounded="md" />
            <Skeleton className="mt-5 h-3.5 w-20" />
            <Skeleton className="mt-3 h-8 w-48" />
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className={cn("h-[24rem] w-full", i > 0 && "hidden md:block", i > 1 && "md:hidden xl:block")} rounded="md" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
