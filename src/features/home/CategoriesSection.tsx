"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft, ArrowRight, Star, MapPin, Clock, CheckCircle2, Sparkles,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────

type Category = {
  id:       string;
  slug:     string;
  nameAr:   string;
  nameEn:   string;
  icon:     string;
  color:    string;
  bgColor:  string;
  iconSvg?: string;
};

interface Props {
  categories: Category[];
}

// ─── Category descriptor map ────────────────────────────────

const SLUG_META: Record<string, { countAr: string; countEn: string }> = {
  medical:     { countAr: "٢٤٠+ مقدم خدمة",  countEn: "240+ providers" },
  dental:      { countAr: "١٨٥+ عيادة",        countEn: "185+ clinics"   },
  beauty:      { countAr: "٣٢٠+ صالون",        countEn: "320+ salons"    },
  fitness:     { countAr: "١٤٠+ جيم",          countEn: "140+ gyms"      },
  legal:       { countAr: "٩٠+ محامي",         countEn: "90+ lawyers"    },
  consulting:  { countAr: "١١٠+ مستشار",       countEn: "110+ advisors"  },
  education:   { countAr: "٢٠٠+ مدرّس",        countEn: "200+ tutors"    },
  veterinary:  { countAr: "٧٠+ عيادة",         countEn: "70+ clinics"    },
};

function getCategoryMeta(slug: string, lang: "ar" | "en", idx: number) {
  if (SLUG_META[slug]) {
    return lang === "ar" ? SLUG_META[slug].countAr : SLUG_META[slug].countEn;
  }
  // Generic fallback based on index for unknown slugs
  const fallbackCounts = ["٦٠+", "٨٥+", "٤٥+", "١٢٠+", "٥٥+", "٧٥+", "٩٥+", "٣٠+"];
  const n = fallbackCounts[idx % fallbackCounts.length];
  return lang === "ar" ? `${n} مقدم خدمة` : `${n} providers`;
}

// ─── Featured businesses mock data ─────────────────────────

const FEATURED_MOCK = [
  {
    id:          "f1",
    slug:        "berrygum",
    nameAr:      "BerryGum",
    nameEn:      "BerryGum",
    specialtyAr: "تجميل وعناية",
    specialtyEn: "Beauty & Care",
    cityAr:      "القاهرة",
    cityEn:      "Cairo",
    rating:      5.0,
    reviews:     1,
    services:    3,
    slotsAr:     ["اليوم ١٠:٠٠ ص", "اليوم ١٢:٠٠ م", "غدًا ٩:٠٠ ص"],
    slotsEn:     ["Today 10:00 AM", "Today 12:00 PM", "Tomorrow 9:00 AM"],
    initial:     "B",
    badgeAr:     "مميز",
    badgeEn:     "Featured",
    headerGrad:  "linear-gradient(150deg, #1a0533 0%, #6d28d9 45%, #a855f7 75%, #d946ef 100%)",
    hotspot:     "radial-gradient(ellipse at 82% 18%, rgba(217,70,239,0.32) 0%, transparent 55%)",
    avatarGrad:  "linear-gradient(140deg, #7c3aed 0%, #d946ef 100%)",
    specialtyBg: "#fdf4ff",
    specialtyFg: "#a21caf",
    slotBg:      "#fdf4ff",
    slotBorder:  "#f0abfc",
    slotFg:      "#a21caf",
  },
];

// ─── Featured Business Card ─────────────────────────────────

function FeaturedCard({
  business,
  lang,
}: {
  business: (typeof FEATURED_MOCK)[number];
  lang: "ar" | "en";
}) {
  const name      = lang === "ar" ? business.nameAr      : business.nameEn;
  const specialty = lang === "ar" ? business.specialtyAr : business.specialtyEn;
  const city      = lang === "ar" ? business.cityAr      : business.cityEn;
  const slots     = lang === "ar" ? business.slotsAr     : business.slotsEn;
  const badge     = lang === "ar" ? business.badgeAr     : business.badgeEn;
  const slotsLabel    = lang === "ar" ? "أقرب المواعيد المتاحة" : "Next available slots";
  const ctaLabel      = lang === "ar" ? "احجز الآن"            : "Book Now";
  const profileLabel  = lang === "ar" ? "عرض الملف"            : "View Profile";
  const reviewSuffix  = lang === "ar" ? "تقييم"                : "reviews";
  const servicesSuffix = lang === "ar" ? "خدمة" : "services";

  return (
    <div
      className="group bg-white rounded-3xl border border-[#E2E8F0] overflow-hidden flex flex-col"
      style={{
        boxShadow: "0 2px 16px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)",
        transition: "box-shadow 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1), border-color 0.28s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 24px 64px rgba(15,23,42,0.13), 0 8px 24px rgba(15,23,42,0.07)";
        el.style.transform = "translateY(-5px)";
        el.style.borderColor = "rgba(147,197,253,0.5)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 2px 16px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.04)";
        el.style.transform = "translateY(0)";
        el.style.borderColor = "#E2E8F0";
      }}
    >

      {/* ══ COVER ══════════════════════════════════════════════ */}
      <div
        className="relative h-48 overflow-hidden shrink-0"
        style={{ background: business.headerGrad }}
      >
        {/* Hotspot light */}
        <div className="absolute inset-0" style={{ background: business.hotspot }} />

        {/* Bottom vignette — so avatar reads cleanly */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.04) 45%, transparent 68%)",
          }}
        />

        {/* Large decorative ring — top end */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "-38%", insetInlineEnd: "-7%",
            width: 240, height: 240,
            borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.09)",
          }}
        />

        {/* Small decorative ring — mid */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "10%", insetInlineEnd: "20%",
            width: 92, height: 92,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)",
          }}
        />

        {/* Subtle dot texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.11) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
            opacity: 0.55,
          }}
        />

        {/* Large watermark initial — unique visual identity per card */}
        <div
          aria-hidden
          className="absolute pointer-events-none select-none"
          style={{
            bottom: "-12%",
            insetInlineStart: "-4%",
            fontSize: 180,
            fontWeight: 900,
            lineHeight: 1,
            color: "rgba(255,255,255,0.055)",
            fontFamily: "inherit",
            userSelect: "none",
          }}
        >
          {business.initial}
        </div>

        {/* Featured badge */}
        {badge && (
          <div
            className="absolute top-4 end-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: "rgba(255,255,255,0.13)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            <Sparkles size={9} className="text-amber-300" />
            <span className="text-[10px] font-bold text-white tracking-wide">{badge}</span>
          </div>
        )}

        {/* Services count chip — bottom-end of cover */}
        <div
          className="absolute bottom-4 end-4 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.18)",
          }}
        >
          <span className="text-[10px] font-semibold text-white">
            {business.services}+ {servicesSuffix}
          </span>
        </div>
      </div>

      {/* ══ BODY ═══════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 px-5 pb-6">

        {/* Avatar — overlaps cover by half (-mt-8 = -32px = half of w-16=64px) */}
        <div className="flex items-end justify-between -mt-8 mb-4">
          <div
            className="relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shrink-0"
            style={{
              background: business.avatarGrad,
              boxShadow: "0 4px 20px rgba(0,0,0,0.24), 0 0 0 4px #ffffff",
            }}
          >
            {business.initial}
          </div>

          {/* Verified pill — floats opposite the avatar */}
          <div className="flex items-center gap-1 pb-0.5">
            <CheckCircle2 size={13} className="text-[#3B82F6]" />
            <span className="text-[10px] font-semibold text-[#3B82F6]">
              {lang === "ar" ? "موثّق" : "Verified"}
            </span>
          </div>
        </div>

        {/* Business name */}
        <h3
          className="text-[15px] font-extrabold text-[#0F172A] leading-snug mb-1"
          style={{ letterSpacing: "-0.015em" }}
        >
          {name}
        </h3>

        {/* Specialty pill + city — single row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span
            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0"
            style={{ background: business.specialtyBg, color: business.specialtyFg }}
          >
            {specialty}
          </span>
          <div className="flex items-center gap-1 text-[11px] text-[#94A3B8] min-w-0">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{city}</span>
          </div>
        </div>

        {/* Stats bar — rating + reviews (compact single row) */}
        <div
          className="flex items-center gap-2.5 py-3 mb-4"
          style={{ borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}
        >
          <div className="flex items-center gap-0.5 shrink-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={12}
                className={
                  i < Math.floor(business.rating)
                    ? "fill-amber-400 text-amber-400"
                    : "fill-[#E2E8F0] text-[#E2E8F0]"
                }
              />
            ))}
          </div>
          <span className="text-sm font-bold text-[#0F172A] leading-none">
            {business.rating}
          </span>
          <span className="text-xs text-[#94A3B8]">
            ({business.reviews} {reviewSuffix})
          </span>
        </div>

        {/* ── Available slots section — the booking-platform differentiator ── */}
        <div className="mb-5">
          <p
            className="text-[10px] font-bold text-[#94A3B8] mb-2.5 uppercase tracking-widest"
          >
            {slotsLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {slots.map((slot) => (
              <span
                key={slot}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{
                  background: business.slotBg,
                  border: `1px solid ${business.slotBorder}`,
                  color: business.slotFg,
                }}
              >
                <Clock size={10} />
                {slot}
              </span>
            ))}
          </div>
        </div>

        {/* ── CTA area ── */}
        <div className="mt-auto flex items-center gap-3">
          <Link
            href={`/company/${business.slug}`}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
              boxShadow: "0 4px 14px rgba(59,130,246,0.28)",
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
              size={14}
              style={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }}
            />
          </Link>

          {/* Secondary: View Profile */}
          <Link
            href={`/company/${business.slug}`}
            className="shrink-0 px-3.5 py-3 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:border-[#93C5FD] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all duration-200"
          >
            {profileLabel}
          </Link>
        </div>

      </div>
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────

export default function CategoriesSection({ categories }: Props) {
  const { t, lang } = useLanguage();
  const c = t.categories;
  const f = t.featured;

  const ArrowIcon = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <section
      className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >

      {/* ── Background layers ── */}

      {/* Very faint dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.16) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Edge fades */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #F8FAFC, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
        style={{ background: "linear-gradient(to top, #F8FAFC, transparent)" }}
      />

      {/* Blue radial glow — top start */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: "-8%",
          top: "-5%",
          width: 650,
          height: 650,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 65%)",
        }}
      />

      {/* Indigo glow — bottom end */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineEnd: "-6%",
          bottom: "5%",
          width: 550,
          height: 550,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 60%)",
        }}
      />

      <div className="container-app relative z-10">

        {/* ── Section header ── */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4"
              style={{
                background: "rgba(219,234,254,0.7)",
                border: "1px solid rgba(147,197,253,0.55)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"
                style={{ boxShadow: "0 0 5px rgba(59,130,246,0.5)" }}
              />
              <span className="text-[#2563EB] text-xs font-semibold tracking-widest uppercase">
                {c.eyebrow}
              </span>
            </div>
            <h2
              className="text-3xl sm:text-4xl font-black text-[#0F172A]"
              style={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}
            >
              {c.title}
            </h2>
          </div>

          <Link
            href="/categories"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors group"
          >
            {c.viewAll}
            <ArrowIcon
              size={15}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
              style={{ transform: lang === "ar" ? "scaleX(-1) translateX(0)" : undefined }}
            />
          </Link>
        </div>

        {/* ── Category grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {categories.map((cat, idx) => (
            <Link
              key={cat.id}
              href={`/businesses?category=${cat.slug}`}
              className="group relative flex flex-col items-center gap-3 p-5 rounded-2xl border border-[#E2E8F0] bg-white text-center transition-all duration-250"
              style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 8px 24px rgba(59,130,246,0.10), 0 2px 8px rgba(15,23,42,0.05)";
                el.style.transform = "translateY(-3px)";
                el.style.borderColor = "rgba(147,197,253,0.7)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.boxShadow = "0 1px 4px rgba(15,23,42,0.04)";
                el.style.transform = "translateY(0)";
                el.style.borderColor = "#E2E8F0";
              }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110"
                style={{ background: cat.bgColor || "#EFF6FF" }}
              >
                {cat.iconSvg ? (
                  <Image
                    src={cat.iconSvg}
                    alt={lang === "en" ? cat.nameEn : cat.nameAr}
                    width={30}
                    height={30}
                    className="object-contain"
                  />
                ) : (
                  <span>{cat.icon}</span>
                )}
              </div>

              {/* Name */}
              <div>
                <span className="block text-sm font-bold text-[#0F172A] group-hover:text-[#2563EB] transition-colors leading-snug">
                  {lang === "en" ? cat.nameEn : cat.nameAr}
                </span>
                <span className="block text-[10px] text-[#94A3B8] mt-0.5 leading-tight">
                  {getCategoryMeta(cat.slug, lang, idx)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* Mobile view-all */}
        <div className="mt-7 text-center md:hidden">
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            {c.viewAll}
            <ArrowIcon size={15} />
          </Link>
        </div>

        {/* ── Featured businesses ── */}
        <div className="mt-20 lg:mt-24">

          {/* Sub-header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-4"
                style={{
                  background: "rgba(219,234,254,0.7)",
                  border: "1px solid rgba(147,197,253,0.55)",
                }}
              >
                <Sparkles size={11} className="text-[#3B82F6]" />
                <span className="text-[#2563EB] text-xs font-semibold tracking-widest uppercase">
                  {f.eyebrow}
                </span>
              </div>
              <h3
                className="text-2xl sm:text-3xl font-black text-[#0F172A]"
                style={{ letterSpacing: "-0.02em", lineHeight: 1.2 }}
              >
                {f.title}
              </h3>
            </div>

            <Link
              href="/businesses"
              className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors group"
            >
              {f.viewAll}
              <ArrowIcon
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }}
              />
            </Link>
          </div>

          {/* Cards grid */}
          <div className="flex justify-center">
            <div className="w-full max-w-sm">
            {FEATURED_MOCK.map((biz) => (
              <FeaturedCard
                key={biz.id}
                business={biz}
                lang={lang}
              />
            ))}
            </div>
          </div>

          {/* Mobile view-all for businesses */}
          <div className="mt-7 text-center md:hidden">
            <Link
              href="/businesses"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
            >
              {f.viewAll}
              <ArrowIcon size={15} />
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
