"use client";

import Image from "next/image";
import { MapPin, Phone, MessageCircle, Share2, CheckCircle2, Star } from "lucide-react";
import type { Business } from "@/types/business";

export default function CompanyHero({ business }: { business: Business }) {
  return (
    <div>
      {/* ── Cover banner — layered treatment ── */}
      <div
        className="relative w-full overflow-hidden"
        style={{ height: "clamp(220px, 36vw, 380px)", background: "#0F172A" }}
      >
        {/* Layer 1: blurred atmospheric background */}
        <Image
          src={business.coverImage}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          priority
          style={{
            filter:    "blur(28px) brightness(0.45) saturate(1.4)",
            transform: "scale(1.12)",
          }}
        />

        {/* Layer 2: dark vignette overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(10,15,28,0.82) 0%, rgba(10,15,28,0.35) 50%, rgba(10,15,28,0.55) 100%)",
          }}
        />

        {/* Layer 3: centered foreground image — contained, never cropped */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative"
            style={{
              width:     "clamp(140px, 28vw, 280px)",
              height:    "clamp(140px, 28vw, 280px)",
              borderRadius: 20,
              overflow:  "hidden",
              boxShadow: "0 8px 48px rgba(0,0,0,0.55), 0 2px 12px rgba(0,0,0,0.4)",
              border:    "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <Image
              src={business.coverImage}
              alt={business.nameAr}
              fill
              sizes="280px"
              className="object-contain"
              priority
              style={{ background: "rgba(15,23,42,0.6)" }}
            />
          </div>
        </div>

        {/* Top-end share pill */}
        <div className="absolute top-4 end-4 flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-white"
            style={{
              background:     "rgba(15,23,42,0.5)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border:         "1px solid rgba(255,255,255,0.15)",
            }}
          >
            <Share2 size={13} />
            مشاركة
          </button>
        </div>

        {/* Open / closed badge — bottom start */}
        <div className="absolute bottom-5 start-5">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              background:     business.isOpen
                ? "rgba(34,197,94,0.88)"
                : "rgba(15,23,42,0.72)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              color:          business.isOpen ? "#FFFFFF" : "#94A3B8",
              border:         business.isOpen
                ? "1px solid rgba(255,255,255,0.22)"
                : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                business.isOpen ? "bg-white animate-pulse" : "bg-[#475569]"
              }`}
            />
            {business.isOpen ? "مفتوح الآن" : "مغلق حاليًا"}
          </span>
        </div>
      </div>

      {/* ── Business identity area ── */}
      <div
        className="border-b"
        style={{ background: "#FFFFFF", borderColor: "#E2E8F0" }}
      >
        <div className="container-app" dir="rtl">
          <div className="relative pb-7 pt-0">

            {/* Logo — overlaps cover, object-contain so nothing is clipped */}
            <div
              className="-mt-12 mb-5 shrink-0 flex items-center justify-center"
              style={{
                width:        88,
                height:       88,
                borderRadius: 20,
                background:   "#FFFFFF",
                border:       "3px solid #FFFFFF",
                boxShadow:    "0 4px 24px rgba(15,23,42,0.14), 0 0 0 1px rgba(226,232,240,0.8)",
                padding:      6,
                position:     "relative",
              }}
            >
              {business.logoImage ? (
                <Image
                  src={business.logoImage}
                  alt={business.nameAr}
                  fill
                  sizes="88px"
                  className="object-contain rounded-2xl"
                  style={{ padding: 6 }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-3xl font-black text-white rounded-2xl"
                  style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
                >
                  {business.nameAr[0]}
                </div>
              )}
            </div>

            {/* Info + actions row */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">

              {/* Left: name + meta */}
              <div className="flex-1 min-w-0">

                {/* Tag pills row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {business.isVerified && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: "#DCFCE7", color: "#15803D" }}
                    >
                      <CheckCircle2 size={11} />
                      موثّق
                    </span>
                  )}
                  <span
                    className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: "#DBEAFE", color: "#1D4ED8" }}
                  >
                    {business.category}
                  </span>
                </div>

                {/* Business name */}
                <h1
                  className="text-3xl md:text-4xl font-black text-[#0F172A] mb-2"
                  style={{ letterSpacing: "-0.025em", lineHeight: 1.15 }}
                >
                  {business.nameAr}
                </h1>

                {business.taglineAr && (
                  <p className="text-[#475569] text-base mb-4" style={{ lineHeight: 1.7 }}>
                    {business.taglineAr}
                  </p>
                )}

                {/* Meta row: rating + location */}
                <div className="flex flex-wrap items-center gap-5">
                  {/* Star rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={15}
                          className={
                            i < Math.floor(business.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "fill-[#E2E8F0] text-[#E2E8F0]"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-sm font-bold text-[#0F172A]">
                      {business.rating.toFixed(1)}
                    </span>
                    {business.reviewCount > 0 && (
                      <span className="text-sm text-[#94A3B8]">
                        ({business.reviewCount.toLocaleString("ar-EG")} تقييم)
                      </span>
                    )}
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-sm text-[#475569]">
                    <MapPin size={14} className="text-[#94A3B8] shrink-0" />
                    <span>{business.locationAr}</span>
                    {business.address && (
                      <>
                        <span className="text-[#CBD5E1]">·</span>
                        <span className="text-[#94A3B8] text-xs truncate max-w-[200px]">
                          {business.address}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: action buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-[#0F172A] border border-[#E2E8F0] bg-white transition-all duration-200"
                    style={{ boxShadow: "0 1px 4px rgba(15,23,42,0.04)" }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.borderColor = "#BFDBFE";
                      el.style.background  = "#EFF6FF";
                      el.style.color       = "#1D4ED8";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.borderColor = "#E2E8F0";
                      el.style.background  = "#FFFFFF";
                      el.style.color       = "#0F172A";
                    }}
                  >
                    <Phone size={15} />
                    اتصل
                  </a>
                )}
                {business.whatsapp && (
                  <a
                    href={`https://wa.me/${business.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white transition-all duration-200"
                    style={{ background: "#25D366", boxShadow: "0 2px 10px rgba(37,211,102,0.30)" }}
                  >
                    <MessageCircle size={15} />
                    واتساب
                  </a>
                )}
                <a
                  href="#booking"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-white transition-all duration-200"
                  style={{
                    background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                    boxShadow:  "0 4px 16px rgba(59,130,246,0.35)",
                  }}
                >
                  احجز موعد
                </a>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
