"use client";

import Link from "next/link";
import { Check, Zap, Crown, Star, ShieldCheck, Headphones, Rocket } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Plan metadata ──────────────────────────────────────────

const PLAN_META = [
  {
    icon:       Star,
    iconBg:     "linear-gradient(135deg, #475569 0%, #64748B 100%)",
    cardBorder: "1px solid #E2E8F0",
    cardBg:     "#FFFFFF",
    shadow:     "0 2px 12px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)",
    shadowHover:"0 12px 36px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
  },
  {
    icon:       Zap,
    iconBg:     "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
    cardBorder: "1.5px solid #3B82F6",
    cardBg:     "#FFFFFF",
    shadow:     "0 8px 40px rgba(59,130,246,0.22), 0 2px 12px rgba(59,130,246,0.12)",
    shadowHover:"0 20px 60px rgba(59,130,246,0.28), 0 6px 20px rgba(59,130,246,0.16)",
  },
  {
    icon:       Crown,
    iconBg:     "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)",
    cardBorder: "1px solid #E2E8F0",
    cardBg:     "#FFFFFF",
    shadow:     "0 2px 12px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)",
    shadowHover:"0 12px 36px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.06)",
  },
];

// ─── Component ─────────────────────────────────────────────

export default function PricingPreview() {
  const { t, lang } = useLanguage();
  const p = t.pricingPreview;

  return (
    <section
      className="relative overflow-hidden py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >

      {/* Radial glow centred behind the featured card */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: "40%", left: "50%", transform: "translate(-50%, -50%)",
          width: 800, height: 700,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, transparent 68%)",
          filter: "blur(4px)",
        }}
      />

      <div className="relative z-10 container-app">

        {/* ── Section header ── */}
        <div className="text-center mb-14">

          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-[#DBEAFE] border border-[#BFDBFE]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span className="text-[#3B82F6] text-xs font-semibold tracking-widest uppercase">
              {p.eyebrow}
            </span>
          </div>

          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] mb-4"
            style={{ letterSpacing: "-0.025em", lineHeight: 1.12 }}
          >
            {p.title}
          </h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto" style={{ lineHeight: 1.75 }}>
            {p.subtitle}
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto items-end">
          {p.plans.map((plan, i) => {
            const isFeatured = i === 1;
            const meta       = PLAN_META[i];
            const IconComp   = meta.icon;

            return (
              <div
                key={plan.name}
                className="relative flex flex-col rounded-3xl p-7 transition-all duration-300"
                style={{
                  background:  meta.cardBg,
                  border:      meta.cardBorder,
                  boxShadow:   meta.shadow,
                  ...(isFeatured ? { transform: "translateY(-10px)" } : {}),
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = meta.shadowHover;
                  if (!isFeatured) el.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.boxShadow = meta.shadow;
                  el.style.transform = isFeatured ? "translateY(-10px)" : "translateY(0)";
                }}
              >

                {/* Featured glow ring */}
                {isFeatured && (
                  <div
                    aria-hidden
                    className="absolute -inset-px rounded-3xl pointer-events-none"
                    style={{
                      background: "linear-gradient(135deg, rgba(59,130,246,0.30) 0%, rgba(99,102,241,0.15) 100%)",
                      mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      maskComposite: "exclude",
                      WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                      WebkitMaskComposite: "xor",
                      padding: "1.5px",
                    }}
                  />
                )}

                {/* Popular badge */}
                {isFeatured && (
                  <div className="absolute -top-4 inset-x-0 flex justify-center">
                    <span
                      className="px-5 py-1.5 rounded-full text-[11px] font-bold text-white tracking-wide uppercase"
                      style={{
                        background:  "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 100%)",
                        boxShadow:   "0 4px 14px rgba(59,130,246,0.50)",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {p.badge}
                    </span>
                  </div>
                )}

                {/* ── Plan icon ── */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 shrink-0"
                  style={{ background: meta.iconBg, boxShadow: isFeatured ? "0 4px 16px rgba(59,130,246,0.35)" : "none" }}
                >
                  <IconComp size={21} className="text-white" strokeWidth={1.75} />
                </div>

                {/* Plan name */}
                <p
                  className="text-base font-bold mb-1"
                  style={{ color: isFeatured ? "#1D4ED8" : "#0F172A" }}
                >
                  {plan.name}
                </p>

                {/* Price */}
                <div className="mb-6 pb-6" style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span
                      className="font-black"
                      style={{
                        fontSize:    "2.75rem",
                        lineHeight:  1,
                        color:       isFeatured ? "#1D4ED8" : "#0F172A",
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {plan.price}
                    </span>
                    {Number(plan.price.replace(/[^\d]/g, "")) > 0 && (
                      <span className="text-sm font-medium text-[#94A3B8]">
                        {lang === "ar" ? "ج.م" : "EGP"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1.5">{plan.period}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <div
                        className="mt-0.5 shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{
                          background: isFeatured ? "rgba(59,130,246,0.12)" : "rgba(16,185,129,0.10)",
                        }}
                      >
                        <Check
                          size={10}
                          strokeWidth={3}
                          className={isFeatured ? "text-[#3B82F6]" : "text-[#10B981]"}
                        />
                      </div>
                      <span className="text-[#475569] leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href="/signup?type=business"
                  className="block w-full py-3 rounded-2xl text-center font-bold text-sm transition-all duration-200"
                  style={
                    isFeatured
                      ? {
                          background:  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                          color:       "#ffffff",
                          boxShadow:   "0 4px 18px rgba(59,130,246,0.45)",
                        }
                      : {
                          background:  "transparent",
                          color:       "#475569",
                          border:      "1.5px solid #E2E8F0",
                        }
                  }
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    if (isFeatured) {
                      el.style.boxShadow = "0 6px 24px rgba(59,130,246,0.55)";
                      el.style.filter    = "brightness(1.06)";
                    } else {
                      el.style.borderColor = "#3B82F6";
                      el.style.color       = "#3B82F6";
                      el.style.background  = "rgba(59,130,246,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    if (isFeatured) {
                      el.style.boxShadow = "0 4px 18px rgba(59,130,246,0.45)";
                      el.style.filter    = "";
                    } else {
                      el.style.borderColor = "#E2E8F0";
                      el.style.color       = "#475569";
                      el.style.background  = "transparent";
                    }
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── Trust row ── */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-10">
          {[
            { icon: ShieldCheck, label: lang === "ar" ? "بدون بطاقة ائتمان" : "No credit card required" },
            { icon: Rocket,      label: lang === "ar" ? "إعداد في ٥ دقائق"   : "5-minute setup"           },
            { icon: Headphones,  label: lang === "ar" ? "دعم فني على مدار الساعة" : "24/7 support"         },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-[#94A3B8]">
              <Icon size={14} strokeWidth={1.8} className="shrink-0 text-[#3B82F6]" />
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* ── View all link ── */}
        <p className="text-center mt-8">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            {p.viewAll}
          </Link>
        </p>

      </div>
    </section>
  );
}
