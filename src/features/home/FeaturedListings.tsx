"use client";

import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, MapPin, Sparkles, Star, Store, Zap } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import type { PublicBusiness } from "@/lib/data";
import { useLanguage } from "@/contexts/LanguageContext";
import { coverClassFor } from "@/lib/category-cover";
import { cdnImage } from "@/lib/cdn-image";
import { countText } from "@/lib/i18n";
import { clock12, money } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { businessName, businessPlace, dayLabel, SaveButton } from "./listing-bits";

interface Props {
  eyebrow: string;
  title: string;
  businesses: PublicBusiness[];
  viewAllHref: string;
}

/**
 * The first listings a visitor sees: one large card and up to three
 * compact ones beside it, on the stone band between the mint
 * categories and the white "near you" panel.
 *
 * The large card is simply the first in the row's own order; it carries
 * no "newest" or "most booked" label of its own, so it never claims
 * more than the ordering does.
 */
export default function FeaturedListings({ eyebrow, title, businesses, viewAllHref }: Props) {
  const { t, lang } = useLanguage();
  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;
  const [lead, ...rest] = businesses;

  return (
    <section className="bg-[var(--color-surface-2)] py-20">
      <div className="container-app">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <span className="section-eyebrow">{eyebrow}</span>
            <h2 className="section-title mt-2.5">{title}</h2>
          </div>
          {businesses.length > 0 && (
            <Link href={viewAllHref} className="btn btn-outline btn-pill btn-sm shrink-0 bg-[var(--color-surface)]">
              {t.featured.viewAll}
              <ArrowIcon size={15} strokeWidth={2} aria-hidden="true" />
            </Link>
          )}
        </div>

        {!lead ? (
          <div className="card">
            <EmptyState
              icon={<Store size={24} strokeWidth={1.7} />}
              title={t.featured.emptyTitle}
              body={t.featured.emptyBody}
              action={
                <Link href="/signup" className="btn btn-primary btn-sm">
                  {t.featured.emptyAction}
                </Link>
              }
            />
          </div>
        ) : (
          <div className={cn("grid gap-5", rest.length > 0 && "lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]")}>
            <LeadCard business={lead} />
            {rest.length > 0 && (
              <ul className="grid list-none content-start gap-4 p-0 lg:content-stretch">
                {rest.map((b) => (
                  <li key={b.id} className="min-w-0">
                    <CompactCard business={b} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LeadCard({ business: b }: { business: PublicBusiness }) {
  const { t, lang } = useLanguage();
  const c = t.businessCard;
  const name = businessName(b, lang);
  const href = `/company/${b.slug}`;

  return (
    <article className="relative isolate flex min-h-[27rem] flex-col justify-end overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-night)] text-[var(--color-inverse)] lg:min-h-[30rem]">
      {b.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cdnImage(b.coverImage, 1200)}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true" className={cn("absolute inset-0 -z-20", coverClassFor(b.category.slug))} />
      )}
      {/* Dark at the foot, where the words are; the photo shows above. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-[rgb(17_32_28/0.94)] via-[rgb(17_32_28/0.55)] to-[rgb(17_32_28/0.08)]"
      />

      <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3 sm:inset-x-7 sm:top-7">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--color-surface)]/95 px-3 py-1.5 text-[0.75rem] font-bold text-[var(--color-ok)]">
            {lang === "ar" ? b.category.nameAr : b.category.nameEn}
          </span>
          {b.autoConfirm && (
            <span className="flex items-center gap-1 rounded-full bg-[var(--color-jade)] px-3 py-1.5 text-[0.75rem] font-bold text-[var(--color-inverse)]">
              <Zap size={12} strokeWidth={2.2} aria-hidden="true" />
              {c.instant}
            </span>
          )}
        </div>
        <SaveButton id={b.id} labels={c} />
      </div>

      <div className="px-5 pb-6 pt-28 sm:px-8 sm:pb-8">
        <h3 className="m-0 flex items-center gap-2 text-[1.75rem] font-bold leading-tight sm:text-[2.25rem]">
          <Link href={href} className="min-w-0 text-inherit transition-opacity hover:opacity-85">
            <span dir="auto" className="line-clamp-2">{name}</span>
          </Link>
          {b.isVerified && (
            <BadgeCheck size={20} aria-label={c.verified} className="shrink-0 text-[var(--color-night-accent)]" />
          )}
        </h3>

        {(b.taglineAr || b.taglineEn) && (
          <p dir="auto" className="m-0 mt-2.5 line-clamp-2 text-start text-[0.9375rem] text-white/85">
            {(lang !== "ar" && b.taglineEn) || b.taglineAr}
          </p>
        )}

        <p className="m-0 mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.84375rem] text-white/80">
          <Rating business={b} tone="dark" />
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={13} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{businessPlace(b, lang)}</span>
          </span>
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/20 pt-5">
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-[0.875rem] text-white/80">
            {b.minPrice !== null && (
              <span>
                {c.from}{" "}
                <strong className="num text-[1.125rem] font-extrabold text-[var(--color-inverse)]">
                  {money(b.minPrice, lang, b.currency)}
                </strong>
              </span>
            )}
            {b.nextSlot && (
              <span className="flex items-center gap-1.5">
                <CalendarClock size={14} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
                {c.nextFree} {dayLabel(b.nextSlot.dayOffset, lang, c)} <span>{clock12(b.nextSlot.time, lang)}</span>
              </span>
            )}
          </p>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Link href={href} className="btn btn-sm btn-pill border border-white/50! bg-transparent! text-[var(--color-inverse)]! hover:bg-white/10!">
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

function CompactCard({ business: b }: { business: PublicBusiness }) {
  const { t, lang } = useLanguage();
  const c = t.businessCard;
  const name = businessName(b, lang);
  const href = `/company/${b.slug}`;

  return (
    <article className="card card-hover relative flex h-full items-center gap-4 p-3 sm:gap-5">
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[var(--radius-md)] sm:h-32 sm:w-40">
        {b.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnImage(b.coverImage, 400)} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className={cn("block h-full w-full", coverClassFor(b.category.slug))} />
        )}
        <SaveButton id={b.id} labels={c} size="sm" className="absolute end-2 top-2 z-10" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pe-2">
        <span className="text-[0.75rem] font-bold text-[var(--color-ok)]">
          {lang === "ar" ? b.category.nameAr : b.category.nameEn}
        </span>
        <h3 className="m-0 flex items-center gap-1.5 text-[1.0625rem] font-bold text-[var(--color-ink)]">
          {/* The whole card is the link; the save button sits above it. */}
          <Link href={href} className="min-w-0 text-inherit after:absolute after:inset-0 after:content-[''] hover:text-[var(--color-jade)]">
            <span dir="auto" className="block truncate">{name}</span>
          </Link>
          {b.isVerified && <BadgeCheck size={15} aria-label={c.verified} className="shrink-0 text-[var(--color-jade)]" />}
        </h3>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-[var(--color-subtle)]">
          <Rating business={b} tone="light" />
          <span className="truncate">{businessPlace(b, lang)}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.8125rem]">
          {b.nextSlot ? (
            <span className="flex items-center gap-1.5 text-[var(--color-jade)]">
              <CalendarClock size={13} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
              {c.nextFree} {dayLabel(b.nextSlot.dayOffset, lang, c)} <span>{clock12(b.nextSlot.time, lang)}</span>
            </span>
          ) : <span />}
          {b.minPrice !== null && (
            <span className="text-[var(--color-subtle)]">
              {c.from}{" "}
              <strong className="num font-extrabold text-[var(--color-ink)]">{money(b.minPrice, lang, b.currency)}</strong>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** The rating, or "new" for a business nobody has reviewed: never a made-up number. */
function Rating({ business: b, tone }: { business: PublicBusiness; tone: "dark" | "light" }) {
  const { t, lang } = useLanguage();
  const c = t.businessCard;
  if (b.ratingAvg !== null && b.ratingCount > 0) {
    return (
      <span className="flex items-center gap-1.5">
        <Star size={14} aria-hidden="true" className="shrink-0 fill-[var(--color-star)] text-[var(--color-star)]" />
        <span className={cn("num font-bold", tone === "dark" ? "text-[var(--color-inverse)]" : "text-[var(--color-ink)]")}>
          {b.ratingAvg.toFixed(1)}
        </span>
        <span>({countText(lang, b.ratingCount, c.reviews)})</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Sparkles size={14} aria-hidden="true" className={cn("shrink-0", tone === "dark" ? "text-[var(--color-night-accent)]" : "text-[var(--color-jade)]")} />
      {c.noReviews}
    </span>
  );
}

/** Same footprint as the real section, so nothing jumps when it lands. */
export function FeaturedListingsSkeleton() {
  return (
    <section className="bg-[var(--color-surface-2)] py-20" aria-hidden="true">
      <div className="container-app">
        <div className="mb-9">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-8 w-72" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
          <Skeleton className="h-[27rem] w-full lg:h-[30rem]" rounded="md" />
          <div className="grid gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[8.5rem] w-full" rounded="md" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
