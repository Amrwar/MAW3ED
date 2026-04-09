import Image from "next/image";
import { MapPin, Phone, MessageCircle, Share2, CheckCircle2, Star } from "lucide-react";
import type { Business } from "@/types/business";

export default function CompanyHero({ business }: { business: Business }) {
  return (
    <div>
      {/* ── Cover image ── */}
      <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden bg-[#1E293B]">
        <Image
          src={business.coverImage}
          alt={business.nameAr}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        {/* Multi-stop dark gradient for readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.25) 45%, rgba(15,23,42,0.10) 75%, transparent 100%)",
          }}
        />

        {/* Decorative vignette sides */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, rgba(15,23,42,0.45) 0%, transparent 70%)",
          }}
        />

        {/* Top-end action pill */}
        <div className="absolute top-4 end-4 flex gap-2">
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-white"
            style={{
              background:     "rgba(15,23,42,0.45)",
              backdropFilter: "blur(12px)",
              border:         "1px solid rgba(255,255,255,0.18)",
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
                ? "rgba(34,197,94,0.90)"
                : "rgba(15,23,42,0.72)",
              backdropFilter: "blur(8px)",
              color:          business.isOpen ? "#FFFFFF" : "#94A3B8",
              border:         business.isOpen
                ? "1px solid rgba(255,255,255,0.25)"
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

            {/* Avatar — overlaps cover */}
            <div
              className="relative -mt-14 mb-5 w-24 h-24 rounded-3xl overflow-hidden shrink-0"
              style={{
                border:    "4px solid #FFFFFF",
                boxShadow: "0 4px 24px rgba(59,130,246,0.18), 0 0 0 1px rgba(226,232,240,0.9)",
              }}
            >
              {business.logoImage ? (
                <Image
                  src={business.logoImage}
                  alt={business.nameAr}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-3xl font-black text-white"
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
