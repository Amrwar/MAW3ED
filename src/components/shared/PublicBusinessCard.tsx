"use client";

import Link from "next/link";
import { MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import type { PublicBusiness } from "@/lib/data";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

const FALLBACK =
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80";

interface Props {
  business:  PublicBusiness;
  className?: string;
  /** Renders a taller cover for featured placement rows */
  featured?: boolean;
}

export default function PublicBusinessCard({ business, className, featured = false }: Props) {
  const { t, lang } = useLanguage();
  const card = t.businessCard;
  const isAr = lang === "ar";

  const name = (lang === "en" && business.nameEn) ? business.nameEn : business.nameAr;
  // city only has nameAr in the selected fields
  const cityName = business.city.nameAr;
  const catName  = isAr
    ? business.category.nameAr
    : ((business.category as { nameEn?: string }).nameEn || business.category.nameAr);

  const cover = business.coverImage || FALLBACK;

  const shadow      = featured
    ? "0 4px 20px rgba(15,23,42,0.09), 0 1px 6px rgba(15,23,42,0.05)"
    : "0 2px 12px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)";
  const shadowHover = "0 14px 44px rgba(15,23,42,0.13), 0 4px 16px rgba(15,23,42,0.07)";

  return (
    <Link
      href={`/company/${business.slug}`}
      className={cn("group block rounded-3xl overflow-hidden", className)}
      style={{
        background:  "#FFFFFF",
        border:      "1px solid #E2E8F0",
        boxShadow:   shadow,
        transition:  "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.boxShadow   = shadowHover;
        el.style.transform   = "translateY(-4px)";
        el.style.borderColor = "rgba(59,130,246,0.28)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.boxShadow   = shadow;
        el.style.transform   = "translateY(0)";
        el.style.borderColor = "#E2E8F0";
      }}
    >

      {/* ── Cover ── */}
      <div className={cn("relative overflow-hidden bg-[#F1F5F9]", featured ? "h-56" : "h-44")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Bottom gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(15,23,42,0.30) 0%, transparent 55%)" }}
        />

        {/* Category badge */}
        <div className="absolute top-3 start-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: business.category.bgColor || "#DBEAFE",
              color:           business.category.color   || "#1D4ED8",
            }}
          >
            {business.category.icon} {catName}
          </span>
        </div>

        {/* Verified badge */}
        {business.isVerified && (
          <div className="absolute top-3 end-3">
            <span className="flex items-center gap-1 text-[11px] font-bold bg-white/95 text-[#0F172A] px-2.5 py-1 rounded-full shadow-sm">
              <CheckCircle2 size={11} className="text-[#3B82F6] shrink-0" />
              {card.verified}
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-5">

        <h3
          className="font-bold text-[#0F172A] text-base leading-snug mb-1.5 transition-colors duration-150 group-hover:text-[#3B82F6]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {name}
        </h3>

        {business.taglineAr ? (
          <p className="text-sm text-[#94A3B8] line-clamp-1 mb-4">{business.taglineAr}</p>
        ) : (
          <div className="mb-4" />
        )}

        {/* Location + price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <MapPin size={12} className="shrink-0" />
            <span>{cityName}</span>
          </div>
          {business.minPrice != null && (
            <span className="text-xs font-bold text-[#0F172A]">
              {card.from} {business.minPrice} {card.currency}
            </span>
          )}
        </div>

        {/* CTA row */}
        <div
          className="mt-4 pt-4 flex items-center justify-between"
          style={{ borderTop: "1px solid #F1F5F9" }}
        >
          <span className="text-xs font-bold text-[#3B82F6] transition-colors group-hover:text-[#2563EB]">
            {card.bookNow}
          </span>
          <ArrowRight
            size={14}
            strokeWidth={2.5}
            className={cn(
              "text-[#3B82F6] transition-all duration-200 group-hover:text-[#2563EB]",
              isAr
                ? "rotate-180 group-hover:-translate-x-1"
                : "group-hover:translate-x-1",
            )}
          />
        </div>
      </div>
    </Link>
  );
}
