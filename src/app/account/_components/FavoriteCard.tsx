"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Heart, MapPin, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { coverClassFor } from "@/lib/category-cover";
import { num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  business: {
    id: string;
    slug: string;
    nameAr: string;
    nameEn: string | null;
    logoImage: string | null;
    coverImage: string | null;
    isVerified: boolean;
    ratingAvg: number | null;
    ratingCount: number;
    category: { slug: string; nameAr: string; nameEn: string };
    city: { nameAr: string; nameEn: string };
  };
}

/**
 * A saved place.
 *
 * Unsaving hides it straight away rather than waiting for a reload —
 * leaving a card the customer has just removed sitting on the page
 * makes the button look broken.
 */
export default function FavoriteCard({ business: b }: Props) {
  const { t, lang } = useLanguage();
  const c = t.businessCard;
  const isAr = lang === "ar";
  const { toggle } = useFavorites();
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  const name = !isAr && b.nameEn ? b.nameEn : b.nameAr;
  const category = isAr ? b.category.nameAr : b.category.nameEn;
  const city = isAr ? b.city.nameAr : b.city.nameEn;

  return (
    <article className="card card-hover flex h-full flex-col overflow-hidden">
      <div className="relative">
        <Link href={`/company/${b.slug}`} aria-label={name} className="block">
          {b.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.coverImage} alt="" loading="lazy" className="h-28 w-full object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className={cn("block h-28 w-full", coverClassFor(b.category.slug))}
            />
          )}
        </Link>

        <button
          type="button"
          onClick={() => {
            toggle(b.id);
            setRemoved(true);
          }}
          aria-label={c.unsave}
          className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-surface)]/95 text-[var(--color-danger)] shadow-[var(--shadow-raised)]"
        >
          <Heart size={16} strokeWidth={2} aria-hidden="true" className="fill-current" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3">
        <h3 className="m-0 flex items-center gap-1.5 text-[0.9375rem] font-bold text-[var(--color-ink)]">
          <Link
            href={`/company/${b.slug}`}
            className="inline-flex min-h-6 min-w-0 items-center text-inherit transition-colors hover:text-[var(--color-jade)]"
          >
            <span className="truncate">{name}</span>
          </Link>
          {b.isVerified && (
            <BadgeCheck size={14} aria-label={c.verified} className="shrink-0 text-[var(--color-jade)]" />
          )}
        </h3>

        <p className="m-0 text-[0.75rem] text-[var(--color-subtle)]">{category}</p>

        <p className="m-0 flex items-center gap-1.5 text-[0.75rem] text-[var(--color-subtle)]">
          <MapPin size={12} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          {city}
        </p>

        {/* Only where the place has actually been reviewed. */}
        {b.ratingAvg !== null && b.ratingCount > 0 && (
          <p className="m-0 flex items-center gap-1.5 text-[0.75rem]">
            <Star
              size={12}
              aria-hidden="true"
              className="fill-[var(--color-star)] text-[var(--color-star)]"
            />
            <span className="num font-bold text-[var(--color-ink)]">{b.ratingAvg.toFixed(1)}</span>
            <span className="text-[var(--color-subtle)]">
              (<span className="num">{num(b.ratingCount, lang)}</span>)
            </span>
          </p>
        )}

        <Link href={`/company/${b.slug}#booking`} className="btn btn-primary btn-sm mt-auto w-full">
          {c.bookNow}
        </Link>
      </div>
    </article>
  );
}
