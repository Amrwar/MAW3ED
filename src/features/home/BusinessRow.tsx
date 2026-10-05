"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Store } from "lucide-react";
import BusinessCard from "@/components/shared/BusinessCard";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import type { PublicBusiness } from "@/lib/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow: string;
  title: string;
  /** Optional one-liner under the title. */
  note?: string;
  businesses: PublicBusiness[];
  /** Where "view all" goes. Omitted when there is nothing more to see. */
  viewAllHref?: string;
  /** Shown in place of the grid when the list is empty. */
  empty?: { title: string; body: string };
  className?: string;
}

/**
 * One row of business cards with a heading. Both the popular row and
 * the city row are this component — they differ only in what they are
 * handed, which is the point: the homepage decides what to show, the
 * row decides how.
 */
export default function BusinessRow({
  eyebrow,
  title,
  note,
  businesses,
  viewAllHref,
  empty,
  className,
}: Props) {
  const { t, lang } = useLanguage();
  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <section className={cn("bg-[var(--color-ground)] pt-20", className)}>
      <div className="container-app">

        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <span className="section-eyebrow">{eyebrow}</span>
            <h2 className="section-title mt-2.5">{title}</h2>
            {note && (
              <p className="mt-2.5 text-[0.875rem] text-[var(--color-subtle)]">{note}</p>
            )}
          </div>

          {viewAllHref && businesses.length > 0 && (
            <Link href={viewAllHref} className="btn btn-outline btn-pill btn-sm shrink-0">
              {t.featured.viewAll}
              <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        </div>

        {businesses.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Store size={24} strokeWidth={1.7} />}
              title={empty?.title ?? t.featured.emptyTitle}
              body={empty?.body ?? t.featured.emptyBody}
              action={
                <Link href="/signup" className="btn btn-primary btn-sm">
                  {t.featured.emptyAction}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((b) => (
              <li key={b.id} className="min-w-0">
                <BusinessCard business={b} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Placeholder for the row while its query runs. Mirrors the card's
 * real proportions so the page does not jump when the data lands.
 */
export function BusinessRowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <section className="bg-[var(--color-ground)] pt-20" aria-hidden="true">
      <div className="container-app">
        <div className="mb-8">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]"
            >
              <Skeleton className="h-[11.5rem] w-full" rounded="sm" />
              <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="mt-2 h-10 w-full" rounded="md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
