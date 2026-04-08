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
  /** Taller cover for featured placement rows */
  featured?: boolean;
}

export default function PublicBusinessCard({ business, className, featured = false }: Props) {
  const { t, lang } = useLanguage();
  const card = t.businessCard;
  const isAr = lang === "ar";

  const name     = (lang === "en" && business.nameEn) ? business.nameEn : business.nameAr;
  const cityName = business.city.nameAr;
  const catName  = isAr
    ? business.category.nameAr
    : ((business.category as { nameEn?: string }).nameEn || business.category.nameAr);

  const cover   = business.coverImage || FALLBACK;
  const initial = name[0]?.toUpperCase() ?? "B";

  const ctaLabel      = isAr ? "احجز الآن"   : "Book Now";
  const profileLabel  = isAr ? "عرض الملف"   : "View Profile";
  const verifiedLabel = isAr ? "موثّق"        : "Verified";
  const fromLabel     = isAr ? "يبدأ من"      : "Starting from";
  const noPriceLabel  = isAr ? "اتصل للسعر"   : "Contact for price";

  const shadow      = "0 2px 16px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)";
  const shadowHover = "0 24px 64px rgba(15,23,42,0.13), 0 8px 24px rgba(15,23,42,0.07)";

  return (
    <div
      className={cn(
        "group bg-white rounded-3xl border border-[#E2E8F0] overflow-hidden flex flex-col",
        className,
      )}
      style={{
        boxShadow:  shadow,
        transition: "box-shadow 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), border-color 0.28s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow   = shadowHover;
        el.style.transform   = "translateY(-5px)";
        el.style.borderColor = "rgba(147,197,253,0.5)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow   = shadow;
        el.style.transform   = "translateY(0)";
        el.style.borderColor = "#E2E8F0";
      }}
    >

      {/* ══ COVER ══════════════════════════════════════════════ */}
      <div className={cn("relative overflow-hidden shrink-0 bg-[#F1F5F9]", featured ? "h-56" : "h-48")}>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Bottom vignette — same as FeaturedCard */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.04) 45%, transparent 68%)",
          }}
        />

        {/* Decorative ring — top end (visual identity flourish) */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-38%", insetInlineEnd: "-7%",
            width: 200, height: 200,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.15)",
          }}
        />

        {/* Category badge — top start */}
        <div className="absolute top-4 start-4 z-10">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
            style={{
              backgroundColor: business.category.bgColor || "#DBEAFE",
              color:           business.category.color   || "#1D4ED8",
            }}
          >
            {business.category.icon} {catName}
          </span>
        </div>

        {/* Verified badge — top end (frosted pill) */}
        {business.isVerified && (
          <div className="absolute top-4 end-4 z-10">
            <span
              className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background:     "rgba(255,255,255,0.92)",
                backdropFilter: "blur(8px)",
                color:          "#0F172A",
              }}
            >
              <CheckCircle2 size={10} className="text-[#3B82F6] shrink-0" />
              {verifiedLabel}
            </span>
          </div>
        )}
      </div>

      {/* ══ BODY ═══════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 px-5 pb-5">

        {/* Avatar overlap + verified label — mirrors FeaturedCard identity row */}
        <div className="flex items-end justify-between -mt-8 mb-4">
          <div
            className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shrink-0 select-none"
            style={{
              background: business.category.color,
              boxShadow:  `0 4px 18px ${business.category.color}55, 0 0 0 3px #ffffff`,
            }}
          >
            {initial}
          </div>

          {business.isVerified && (
            <div className="flex items-center gap-1 pb-0.5">
              <CheckCircle2 size={12} className="text-[#3B82F6] shrink-0" />
              <span className="text-[10px] font-semibold text-[#3B82F6]">{verifiedLabel}</span>
            </div>
          )}
        </div>

        {/* Business name */}
        <h3
          className="text-[15px] font-extrabold text-[#0F172A] leading-snug mb-1"
          style={{ letterSpacing: "-0.015em" }}
        >
          {name}
        </h3>

        {/* Specialty pill + city — same row as FeaturedCard */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
            style={{ background: business.category.bgColor, color: business.category.color }}
          >
            {catName}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-[#94A3B8] min-w-0">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{cityName}</span>
          </div>
        </div>

        {/* Tagline — fixed-height slot so cards align even without a tagline */}
        <div className="mb-4" style={{ minHeight: "2.5rem" }}>
          {business.taglineAr && (
            <p className="text-sm text-[#475569] line-clamp-2" style={{ lineHeight: 1.6 }}>
              {business.taglineAr}
            </p>
          )}
        </div>

        {/* Price bar — visual treatment mirrors homepage stats bar */}
        <div
          className="flex items-center justify-between py-3 mb-4"
          style={{ borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}
        >
          {business.minPrice != null ? (
            <>
              <span className="text-[11px] font-medium text-[#94A3B8]">{fromLabel}</span>
              <span className="text-sm font-black text-[#0F172A]">
                {business.minPrice}{" "}
                <span className="text-xs font-semibold text-[#94A3B8]">{business.currency}</span>
              </span>
            </>
          ) : (
            <span className="text-xs text-[#94A3B8]">{noPriceLabel}</span>
          )}
        </div>

        {/* CTA area — matches FeaturedCard dual-button layout */}
        <div className="mt-auto flex items-center gap-2.5">

          {/* Primary: Book Now */}
          <Link
            href={`/company/${business.slug}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
              boxShadow:  "0 4px 14px rgba(59,130,246,0.28)",
              transition: "box-shadow 0.2s ease, transform 0.2s ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 6px 22px rgba(59,130,246,0.42)";
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.boxShadow = "0 4px 14px rgba(59,130,246,0.28)";
              el.style.transform = "translateY(0)";
            }}
          >
            {ctaLabel}
            <ArrowRight
              size={13}
              strokeWidth={2.5}
              style={{ transform: isAr ? "scaleX(-1)" : undefined }}
            />
          </Link>

          {/* Secondary: View Profile */}
          <Link
            href={`/company/${business.slug}`}
            className="shrink-0 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#64748B] transition-all duration-200 hover:border-[#93C5FD] hover:text-[#2563EB] hover:bg-[#EFF6FF]"
            style={{ border: "1px solid #E2E8F0" }}
          >
            {profileLabel}
          </Link>
        </div>

      </div>
    </div>
  );
}
