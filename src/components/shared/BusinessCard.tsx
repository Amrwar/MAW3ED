"use client";

import Link from "next/link";
import { countText } from "@/lib/i18n";
import {
  BadgeCheck,
  CalendarClock,
  Heart,
  MapPin,
  Star,
  Wallet,
  Zap,
} from "lucide-react";
import type { DiscoveryBusiness } from "@/lib/discovery/search";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFavorites } from "@/hooks/useFavorites";
import { coverClassFor } from "@/lib/category-cover";
import { money } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  business: DiscoveryBusiness;
  className?: string;
}

/**
 * One business in a listing.
 *
 * Everything on it is read from the record. A business with no reviews
 * says so, a business with no price says so, and a business whose owner
 * has not set opening hours shows no open/closed badge at all rather
 * than being reported shut.
 */
export default function BusinessCard({ business: b, className }: Props) {
  const { t, lang } = useLanguage();
  const c = t.businessCard;
  const isAr = lang === "ar";
  const { isFavorite, toggle } = useFavorites();

  const name = !isAr && b.nameEn ? b.nameEn : b.nameAr;
  const categoryName = isAr ? b.category.nameAr : b.category.nameEn;
  const place = [b.neighborhood && (isAr ? b.neighborhood.nameAr : b.neighborhood.nameEn), isAr ? b.city.nameAr : b.city.nameEn]
    .filter(Boolean)
    .join(isAr ? "، " : ", ");

  const href = `/company/${b.slug}`;
  const saved = isFavorite(b.id);

  const dayLabel = (offset: number) =>
    offset === 0 ? c.today : offset === 1 ? c.tomorrow : countText(lang, offset, c.inDays);

  return (
    <article
      className={cn(
        "card card-hover group flex h-full flex-col overflow-hidden",
        className,
      )}
    >
      {/* ── Cover ── */}
      <div className="relative shrink-0">
        <Link href={href} aria-label={name} className="block">
          {b.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={b.coverImage}
              alt=""
              loading="lazy"
              className="h-[11.5rem] w-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className={cn("block h-[11.5rem] w-full", coverClassFor(b.category.slug))}
            />
          )}
        </Link>

        <span className="absolute start-3.5 top-3.5 rounded-full bg-[var(--color-surface)]/95 px-3 py-1.5 text-[0.71875rem] font-bold text-[var(--color-ok)]">
          {categoryName}
        </span>

        {/* Saved to this browser, not to an account — hence the wording
            in the label rather than a bare "favourite". */}
        <button
          type="button"
          onClick={() => toggle(b.id)}
          aria-pressed={saved}
          aria-label={saved ? c.unsave : c.save}
          className={cn(
            "absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-full",
            "bg-[var(--color-surface)]/95 shadow-[var(--shadow-raised)] transition-colors",
            saved
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-muted)] hover:text-[var(--color-danger)]",
          )}
        >
          <Heart
            size={17}
            strokeWidth={2}
            aria-hidden="true"
            className={saved ? "fill-current" : undefined}
          />
        </button>

        {/* The owner's logo, where there is one and a cover behind it. */}
        {b.logoImage && b.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={b.logoImage}
            alt=""
            loading="lazy"
            className="absolute -bottom-6 start-5 h-12 w-12 rounded-[var(--radius-md)] border-2 border-[var(--color-surface)] bg-[var(--color-surface)] object-cover"
          />
        )}
      </div>

      {/* ── Body ── */}
      <div
        className={cn(
          "flex flex-1 flex-col gap-2.5 px-5 pb-5",
          b.logoImage && b.coverImage ? "pt-9" : "pt-4",
        )}
      >
        <div className="min-w-0">
          <h3 className="m-0 flex items-center gap-1.5 text-[1.0625rem] font-bold text-[var(--color-ink)]">
            <Link
              href={href}
              className="inline-flex min-h-6 min-w-0 items-center text-inherit transition-colors hover:text-[var(--color-jade)]"
            >
              <span className="truncate">{name}</span>
            </Link>
            {b.isVerified && (
              <BadgeCheck
                size={15}
                aria-label={c.verified}
                className="shrink-0 text-[var(--color-jade)]"
              />
            )}
          </h3>

          {b.taglineAr && (
            <p className="m-0 mt-1 line-clamp-1 text-[0.8125rem] text-[var(--color-subtle)]">
              {b.taglineAr}
            </p>
          )}
        </div>

        {/* Rating. Never a substituted number — a business nobody has
            reviewed says exactly that. */}
        <p className="m-0 flex items-center gap-1.5 text-[0.8125rem]">
          {b.ratingAvg !== null && b.ratingCount > 0 ? (
            <>
              <Star
                size={14}
                aria-hidden="true"
                className="shrink-0 fill-[var(--color-star)] text-[var(--color-star)]"
              />
              <span className="num font-bold text-[var(--color-ink)]">
                {b.ratingAvg.toFixed(1)}
              </span>
              <span className="text-[var(--color-subtle)]">
                ({countText(lang, b.ratingCount, c.reviews)})
              </span>
            </>
          ) : (
            <>
              <Star size={14} aria-hidden="true" className="shrink-0 text-[var(--color-line-2)]" />
              <span className="text-[var(--color-subtle)]">{c.noReviews}</span>
            </>
          )}
        </p>

        <p className="m-0 flex items-center gap-1.5 text-[0.78125rem] text-[var(--color-subtle)]">
          <MapPin size={13} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{place}</span>
        </p>

        {/* Open / closed, and the first appointment actually free. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.78125rem]">
          {b.open.state === "open" && (
            <span className="flex items-center gap-1.5 font-bold text-[var(--color-ok)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
              {c.openNow}
              <span className="font-normal text-[var(--color-subtle)]">
                · {c.until} <span className="num">{b.open.closesAt}</span>
              </span>
            </span>
          )}
          {b.open.state === "closed" && (
            <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--color-line-2)]" />
              {c.closed}
            </span>
          )}

          {b.nextSlot && (
            <span className="flex items-center gap-1.5 text-[var(--color-jade)]">
              <CalendarClock size={13} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
              {c.nextFree} {dayLabel(b.nextSlot.dayOffset)}{" "}
              <span className="num">{b.nextSlot.time}</span>
            </span>
          )}
        </div>

        {(b.autoConfirm || b.acceptsOnlinePayment) && (
          <div className="flex flex-wrap gap-1.5">
            {b.autoConfirm && (
              <span className="badge badge-accent gap-1">
                <Zap size={11} strokeWidth={2.2} aria-hidden="true" />
                {c.instant}
              </span>
            )}
            {b.acceptsOnlinePayment && (
              <span className="badge badge-default gap-1">
                <Wallet size={11} strokeWidth={2.2} aria-hidden="true" />
                {c.onlinePayment}
              </span>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        {/* Wraps rather than squeezing: the two buttons are shrink-0, so
            on a narrow card the price was left with whatever pixels
            remained — about forty — and "السعر غير محدد" came out
            stacked three words tall. Given a line of its own it reads
            as a sentence. */}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2.5 border-t border-[var(--color-line)] pt-3.5">
          <span className="text-[0.8125rem] text-[var(--color-subtle)]">
            {b.minPrice !== null ? (
              <>
                {c.from}{" "}
                <strong className="num text-[0.9375rem] font-extrabold text-[var(--color-ink)]">
                  {money(b.minPrice, lang, b.currency)}
                </strong>
              </>
            ) : (
              // Never "0 ج.م": a service left at the default has no
              // price, and saying so is more useful than saying free.
              c.priceUnset
            )}
          </span>

          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Link href={href} className="btn btn-outline btn-sm btn-pill">
              {c.viewProfile}
            </Link>
            <Link href={`${href}#book`} className="btn btn-primary btn-sm btn-pill">
              {c.bookNow}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Placeholder with the card's real proportions, so nothing jumps. */
export function BusinessCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]"
    >
      <span className="skeleton block h-[11.5rem] w-full" />
      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <span className="skeleton block h-4 w-2/3 rounded-[var(--radius-sm)]" />
        <span className="skeleton block h-3 w-1/2 rounded-[var(--radius-sm)]" />
        <span className="skeleton block h-3 w-2/5 rounded-[var(--radius-sm)]" />
        <span className="skeleton mt-3 block h-11 w-full rounded-[var(--radius-md)]" />
      </div>
    </div>
  );
}
