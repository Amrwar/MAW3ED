"use client";

import { MapPin, Share2, Heart, BadgeCheck, Star } from "lucide-react";
import type { Business } from "@/types/business";
import { getInitials } from "@/lib/utils";
import { rating as fmtRating, countIn } from "@/lib/fmt";
import { useLanguage } from "@/contexts/LanguageContext";
import { coverClassFor } from "@/lib/category-cover";

/**
 * Cover photos crop rather than letterbox. The previous build scaled
 * the logo to fill the banner and blurred a copy behind it, which is
 * why every business page showed a smeared wordmark. A business with
 * no cover now gets the wallpaper for its trade instead.
 */

/** A logo stored in the cover slot is not a cover; treat it as absent. */
function hasRealCover(b: Business): boolean {
  return !!b.coverImage && b.coverImage !== b.logoImage;
}

export default function CompanyHero({ business }: { business: Business }) {
  const { lang } = useLanguage();

  return (
    <header>
      {/* ── Cover band ── */}
      <div className="relative">
        {hasRealCover(business) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.coverImage}
            alt=""
            className="h-[clamp(11rem,26vw,19rem)] w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className={`h-[clamp(11rem,26vw,19rem)] w-full ${coverClassFor(business.categorySlug)}`}
          />
        )}

        <div className="absolute end-5 top-5 flex gap-2.5">
          <button
            type="button"
            aria-label="مشاركة"
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/95 text-[var(--color-ink)]"
          >
            <Share2 size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="أضف إلى المفضلة"
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-white/95 text-[var(--color-ink)]"
          >
            <Heart size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Identity ── */}
      <div className="bg-[var(--color-ground)]">
        <div className="container-app pb-6 pt-5">
          <div className="flex flex-wrap items-start gap-5">

            {/* Logo */}
            {business.logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoImage}
                alt={business.nameAr}
                className="h-[4.75rem] w-[4.75rem] shrink-0 rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] object-contain p-2"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[1.625rem] font-extrabold text-[var(--color-jade)]"
              >
                {getInitials(business.nameAr)}
              </span>
            )}

            <div className="min-w-0 flex-[1_1_20rem]">
              <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
                <span
                  className={
                    business.isOpen
                      ? "badge badge-success"
                      : "badge badge-default"
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full ${business.isOpen ? "bg-[var(--color-jade)]" : "bg-[var(--color-faint)]"}`}
                  />
                  {business.isOpen ? "مفتوح الآن" : "مغلق حاليًا"}
                </span>
                <span className="badge badge-outline">{business.category}</span>
                {business.isVerified && (
                  <span className="badge badge-accent">
                    <BadgeCheck size={12} aria-hidden="true" />
                    موثّق
                  </span>
                )}
              </div>

              <h1 className="m-0 text-[clamp(1.75rem,4vw,2.5rem)] font-light leading-[1.12] tracking-tight text-[var(--color-ink)]">
                {business.nameAr}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-5 text-[0.84375rem] text-[var(--color-muted)]">
                {business.reviewCount > 0 && (
                  <span className="flex items-center gap-1.5 font-bold text-[var(--color-ink)]">
                    <Star size={15} className="fill-[var(--color-star)] text-[var(--color-star)]" aria-hidden="true" />
                    <span className="num">{fmtRating(business.rating)}</span>
                    <span className="font-normal text-[var(--color-subtle)]">
                      ({countIn(lang, business.reviewCount, { one: "تقييم واحد", two: "تقييمين", few: "تقييمات", many: "تقييم" }, { one: "review" })})
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin size={15} strokeWidth={1.8} aria-hidden="true" />
                  {business.address || business.locationAr}
                </span>
              </div>
            </div>

            <a href="#booking" className="btn btn-primary btn-pill shrink-0">
              احجز موعد
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
