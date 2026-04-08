"use client";

import Link from "next/link";
import { MapPin, CheckCircle } from "lucide-react";
import type { PublicBusiness } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const FALLBACK =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80";

interface Props {
  business:  PublicBusiness;
  className?: string;
}

export default function PublicBusinessCard({ business, className }: Props) {
  const { t, lang } = useLanguage();
  const card = t.businessCard;
  const cover = business.coverImage || FALLBACK;

  return (
    <Link
      href={`/company/${business.slug}`}
      className={cn(
        "group block bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden",
        "hover:shadow-lg hover:border-[var(--color-accent)]/30 transition-all duration-200",
        className
      )}
    >
      {/* Cover */}
      <div className="relative h-44 overflow-hidden bg-[var(--color-surface-2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={business.nameAr}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Category badge */}
        <div className="absolute top-3 start-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              backgroundColor: business.category.bgColor,
              color:           business.category.color,
            }}
          >
            {business.category.icon}{" "}
            {lang === "en"
              ? ((business.category as { nameEn?: string }).nameEn || business.category.nameAr)
              : business.category.nameAr}
          </span>
        </div>

        {/* Verified */}
        {business.isVerified && (
          <div className="absolute top-3 end-3">
            <span className="flex items-center gap-1 text-xs font-semibold bg-white/95 text-green-700 px-2 py-0.5 rounded-full shadow-sm">
              <CheckCircle size={11} className="text-green-500" />
              {card.verified}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="font-bold text-[var(--color-text-primary)] text-base leading-snug mb-1 group-hover:text-[var(--color-accent)] transition-colors">
          {lang === "en" && business.nameEn ? business.nameEn : business.nameAr}
        </h3>

        {business.taglineAr && (
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-1 mb-3">
            {business.taglineAr}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <MapPin size={12} />
            <span>
              {lang === "en"
                ? ((business.city as { nameEn?: string }).nameEn || business.city.nameAr)
                : business.city.nameAr}
            </span>
          </div>
          {business.minPrice != null && (
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {card.from} {business.minPrice} {card.currency}
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <span className="text-xs font-semibold text-[var(--color-accent)]">
            {card.bookNow}
          </span>
        </div>
      </div>
    </Link>
  );
}
