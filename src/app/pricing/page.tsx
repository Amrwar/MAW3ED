"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Zap, Crown, Sparkles, ChevronDown } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { PLAN_FEATURES, PLAN_PRICES_EGP, PLAN_NAMES_AR, PLAN_NAMES_EN } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

type PlanId = "FREE" | "GROWTH" | "PRO";

// ─── Feature list (concise labels for both cards + table) ──────────────────

const FEATURES_LIST_AR = [
  { key: "monthlyBookings" as const, label: "الحجوزات الشهرية" },
  { key: "whatsapp"        as const, label: "إشعارات واتساب" },
  { key: "analytics"       as const, label: "الإحصائيات والتقارير" },
  { key: "deposits"        as const, label: "دفع العربون (Paymob)" },
  { key: "customBranding"  as const, label: "إخفاء شعار موعد" },
];
const FEATURES_LIST_EN = [
  { key: "monthlyBookings" as const, label: "Monthly Bookings" },
  { key: "whatsapp"        as const, label: "WhatsApp Notifications" },
  { key: "analytics"       as const, label: "Analytics & Reports" },
  { key: "deposits"        as const, label: "Deposit Payments (Paymob)" },
  { key: "customBranding"  as const, label: "Remove Maw3ed Branding" },
];

// ─── Plan visual config ────────────────────────────────────────────────────

type PlanCfg = {
  icon:      React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
  iconBg:    string;
  iconColor: string;
  featured:  boolean;
  ctaHref:   string;
  descAr:    string;
  descEn:    string;
};

const PLANS_CONFIG: Record<PlanId, PlanCfg> = {
  FREE: {
    icon:      Sparkles,
    iconBg:    "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)",
    iconColor: "#64748B",
    featured:  false,
    ctaHref:   "/signup",
    descAr:    "للمبتدئين والتجربة",
    descEn:    "For getting started",
  },
  GROWTH: {
    icon:      Zap,
    iconBg:    "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
    iconColor: "#FFFFFF",
    featured:  true,
    ctaHref:   "/dashboard/settings?tab=subscription",
    descAr:    "للأعمال في مرحلة النمو",
    descEn:    "For growing businesses",
  },
  PRO: {
    icon:      Crown,
    iconBg:    "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
    iconColor: "#FFFFFF",
    featured:  false,
    ctaHref:   "/dashboard/settings?tab=subscription",
    descAr:    "للأعمال الاحترافية",
    descEn:    "For established businesses",
  },
};

const PLAN_ORDER: PlanId[] = ["FREE", "GROWTH", "PRO"];

// ─── Feature icon helpers ─────────────────────────────────────────────────

function CheckCircle() {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "#DCFCE7" }}
    >
      <Check size={11} strokeWidth={2.5} style={{ color: "#16A34A" }} />
    </div>
  );
}

function MinusCircle() {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "#F1F5F9" }}
    >
      <Minus size={11} strokeWidth={2} style={{ color: "#CBD5E1" }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { t, lang } = useLanguage();
  const p    = t.pricing;
  const isAr = lang === "ar";

  const featuresList = isAr ? FEATURES_LIST_AR : FEATURES_LIST_EN;
  const planNames    = isAr ? PLAN_NAMES_AR    : PLAN_NAMES_EN;
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const planCtas: Record<PlanId, string> = {
    FREE:   isAr ? "ابدأ مجانًا"       : "Start Free",
    GROWTH: isAr ? "ابدأ بالنمو"       : "Get Started",
    PRO:    isAr ? "الترقية للاحترافي" : "Upgrade to Pro",
  };

  const trustItems = isAr
    ? ["بدون بطاقة ائتمان", "إلغاء في أي وقت", "إعداد في ٥ دقائق"]
    : ["No credit card required", "Cancel anytime", "5-minute setup"];

  return (
    <>
      <Navbar />
      <main className="min-h-screen" style={{ background: "#F8FAFC" }}>

        <PageHero
          badge={p.eyebrow}
          title={p.title}
          subtitle={p.subtitle}
          dir={isAr ? "rtl" : "ltr"}
        />

        {/* ══════════════════════════════════════════════════
            Pricing section
        ══════════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          dir={isAr ? "rtl" : "ltr"}
        >

          {/* Ambient blue glow */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 pointer-events-none"
            style={{
              height: 500,
              background:
                "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 100%)",
            }}
          />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 relative z-10">

            {/* ── Plan cards ──────────────────────────────── */}
            <div className="grid md:grid-cols-3 gap-5 items-start">
              {PLAN_ORDER.map((planId) => {
                const cfg    = PLANS_CONFIG[planId];
                const Icon   = cfg.icon;
                const price  = PLAN_PRICES_EGP[planId];
                const isFree = price === 0;
                const { featured } = cfg;

                return (
                  <div
                    key={planId}
                    className="relative flex flex-col rounded-3xl bg-white overflow-hidden"
                    style={{
                      border: featured
                        ? "1px solid rgba(59,130,246,0.38)"
                        : "1px solid #E2E8F0",
                      boxShadow: featured
                        ? "0 0 0 4px rgba(59,130,246,0.08), 0 24px 64px rgba(59,130,246,0.14), 0 8px 24px rgba(15,23,42,0.06)"
                        : "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)",
                      transform: featured ? "translateY(-10px)" : "translateY(0)",
                      transition: "box-shadow 0.25s ease, transform 0.25s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!featured) {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                          "0 8px 32px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.04)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!featured) {
                        (e.currentTarget as HTMLDivElement).style.boxShadow =
                          "0 1px 4px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)";
                        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      }
                    }}
                  >

                    {/* Blue top accent bar (featured only) */}
                    {featured && (
                      <div
                        className="h-1 w-full shrink-0"
                        style={{
                          background:
                            "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)",
                        }}
                      />
                    )}

                    <div className="flex flex-col flex-1 p-7">

                      {/* Most Popular badge (featured only) */}
                      {featured && (
                        <div
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-5 self-start"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(29,78,216,0.10) 0%, rgba(59,130,246,0.10) 100%)",
                            border: "1px solid rgba(59,130,246,0.25)",
                          }}
                        >
                          <Zap size={10} style={{ color: "#3B82F6" }} />
                          <span
                            className="font-bold uppercase"
                            style={{
                              color: "#2563EB",
                              fontSize: 10,
                              letterSpacing: "0.06em",
                            }}
                          >
                            {p.mostPopular}
                          </span>
                        </div>
                      )}

                      {/* Icon + name + description */}
                      <div className="flex items-start gap-4 mb-7">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                          style={{ background: cfg.iconBg }}
                        >
                          <Icon
                            size={22}
                            strokeWidth={1.75}
                            style={{ color: cfg.iconColor }}
                          />
                        </div>
                        <div>
                          <h2
                            className="text-base font-black text-[#0F172A]"
                            style={{ letterSpacing: "-0.015em" }}
                          >
                            {planNames[planId]}
                          </h2>
                          <p className="text-xs text-[#94A3B8] mt-0.5">
                            {isAr ? cfg.descAr : cfg.descEn}
                          </p>
                        </div>
                      </div>

                      {/* Price block */}
                      <div className="mb-7">
                        {isFree ? (
                          <p
                            className="text-4xl font-black"
                            style={{ color: "#0F172A", letterSpacing: "-0.03em" }}
                          >
                            {isAr ? "مجاني" : "Free"}
                          </p>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className="text-4xl font-black"
                                style={{
                                  color: featured ? "#1D4ED8" : "#0F172A",
                                  letterSpacing: "-0.03em",
                                }}
                              >
                                {price.toLocaleString(isAr ? "ar-EG" : "en-US")}
                              </span>
                              <span className="text-sm font-semibold text-[#94A3B8]">
                                {isAr ? "ج.م" : "EGP"}
                              </span>
                            </div>
                            <p className="text-xs text-[#94A3B8] mt-1">
                              {isAr ? "شهريًا · يُجدَّد تلقائيًا" : "per month · auto-renewed"}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px mb-7" style={{ background: "#F1F5F9" }} />

                      {/* Feature list */}
                      <ul className="space-y-3.5 mb-8 flex-1">
                        {featuresList.map(({ key, label }) => {
                          const val     = PLAN_FEATURES[planId][key];
                          const enabled = typeof val === "boolean" ? val : true;
                          const display = key === "monthlyBookings"
                            ? (val === Infinity ? p.unlimited : `${val} ${p.bookings}`)
                            : label;

                          return (
                            <li key={key} className="flex items-center gap-3">
                              {enabled ? <CheckCircle /> : <MinusCircle />}
                              <span
                                className="text-sm"
                                style={{ color: enabled ? "#334155" : "#94A3B8" }}
                              >
                                {display}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      {/* CTA */}
                      {planId === "FREE" && (
                        <Link
                          href={cfg.ctaHref}
                          className="block text-center py-3 rounded-2xl text-sm font-bold transition-all duration-150"
                          style={{
                            background:  "#F8FAFC",
                            border:      "1.5px solid #E2E8F0",
                            color:       "#475569",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background    = "#F1F5F9";
                            e.currentTarget.style.borderColor   = "#CBD5E1";
                            e.currentTarget.style.color         = "#0F172A";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background    = "#F8FAFC";
                            e.currentTarget.style.borderColor   = "#E2E8F0";
                            e.currentTarget.style.color         = "#475569";
                          }}
                        >
                          {planCtas[planId]}
                        </Link>
                      )}

                      {planId === "GROWTH" && (
                        <Link
                          href={cfg.ctaHref}
                          className="block text-center py-3 rounded-2xl text-sm font-bold text-white transition-all duration-150"
                          style={{
                            background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                            boxShadow:  "0 4px 16px rgba(59,130,246,0.40)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 6px 22px rgba(59,130,246,0.52)";
                            e.currentTarget.style.filter    = "brightness(1.06)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(59,130,246,0.40)";
                            e.currentTarget.style.filter    = "";
                          }}
                        >
                          {planCtas[planId]}
                        </Link>
                      )}

                      {planId === "PRO" && (
                        <Link
                          href={cfg.ctaHref}
                          className="block text-center py-3 rounded-2xl text-sm font-bold text-white transition-all duration-150"
                          style={{
                            background: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
                            boxShadow:  "0 4px 16px rgba(245,158,11,0.28)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = "0 6px 22px rgba(245,158,11,0.44)";
                            e.currentTarget.style.filter    = "brightness(1.04)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = "0 4px 16px rgba(245,158,11,0.28)";
                            e.currentTarget.style.filter    = "";
                          }}
                        >
                          {planCtas[planId]}
                        </Link>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Trust row */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 mt-8">
              {trustItems.map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check size={13} strokeWidth={2.5} style={{ color: "#22C55E" }} />
                  <span className="text-xs font-medium text-[#475569]">{item}</span>
                </div>
              ))}
            </div>

            {/* ══════════════════════════════════════════════
                Feature comparison table
            ══════════════════════════════════════════════ */}
            <div className="mt-24">

              {/* Section heading */}
              <div className="text-center mb-10">
                <h2
                  className="text-2xl font-black text-[#0F172A]"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  {p.comparison}
                </h2>
              </div>

              {/* Table card */}
              <div
                className="overflow-hidden rounded-3xl"
                style={{
                  border:     "1px solid #E2E8F0",
                  boxShadow:  "0 4px 24px rgba(15,23,42,0.06), 0 1px 4px rgba(15,23,42,0.03)",
                }}
              >
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 520 }}>

                    {/* Dark navy header */}
                    <thead>
                      <tr style={{ background: "#0F172A" }}>
                        <th
                          className="text-start px-6 py-5 font-semibold"
                          style={{ color: "#64748B", width: "42%" }}
                        >
                          {p.feature}
                        </th>
                        {PLAN_ORDER.map((planId) => {
                          const cfg  = PLANS_CONFIG[planId];
                          const Icon = cfg.icon;
                          return (
                            <th
                              key={planId}
                              className="text-center px-4 py-5"
                              style={{
                                background: cfg.featured ? "#1D4ED8" : "transparent",
                                borderInlineStart: cfg.featured ? "none" : "none",
                              }}
                            >
                              <div className="flex flex-col items-center gap-1.5">
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                                  style={{
                                    background: cfg.featured
                                      ? "rgba(255,255,255,0.18)"
                                      : "rgba(255,255,255,0.07)",
                                  }}
                                >
                                  <Icon
                                    size={14}
                                    strokeWidth={1.75}
                                    style={{ color: "#FFFFFF" }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-white">
                                  {planNames[planId]}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    {/* Body rows */}
                    <tbody>
                      {featuresList.map(({ key, label }, i) => (
                        <tr key={key}>
                          {/* Feature label */}
                          <td
                            className="px-6 py-4 font-medium text-[#0F172A]"
                            style={{
                              background:   i % 2 === 0 ? "#FFFFFF" : "#F8FAFC",
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            {label}
                          </td>

                          {/* Plan cells */}
                          {PLAN_ORDER.map((planId) => {
                            const cfg = PLANS_CONFIG[planId];
                            const val = PLAN_FEATURES[planId][key];

                            const rowBg = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
                            const cellBg = cfg.featured
                              ? i % 2 === 0
                                ? "rgba(59,130,246,0.05)"
                                : "rgba(59,130,246,0.03)"
                              : rowBg;

                            let content: React.ReactNode;
                            if (key === "monthlyBookings") {
                              content = (
                                <span
                                  className="font-bold"
                                  style={{ color: cfg.featured ? "#1D4ED8" : "#0F172A" }}
                                >
                                  {val === Infinity ? p.unlimited : `${val} ${p.bookings}`}
                                </span>
                              );
                            } else if (val) {
                              content = (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                                  style={{ background: "#DCFCE7" }}
                                >
                                  <Check size={12} strokeWidth={2.5} style={{ color: "#16A34A" }} />
                                </div>
                              );
                            } else {
                              content = (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                                  style={{ background: "#F1F5F9" }}
                                >
                                  <Minus size={12} strokeWidth={2} style={{ color: "#CBD5E1" }} />
                                </div>
                              );
                            }

                            return (
                              <td
                                key={planId}
                                className="px-4 py-4 text-center"
                                style={{
                                  background:   cellBg,
                                  borderBottom: "1px solid #F1F5F9",
                                }}
                              >
                                {content}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════
                FAQ accordion
            ══════════════════════════════════════════════ */}
            <div className="mt-24 max-w-2xl mx-auto">

              <div className="text-center mb-10">
                <h2
                  className="text-2xl font-black text-[#0F172A]"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  {p.faqTitle}
                </h2>
              </div>

              <div className="space-y-3">
                {p.faqs.map(({ q, a }, i) => {
                  const isOpen = openFaq === i;
                  return (
                    <div
                      key={i}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        border:     isOpen ? "1.5px solid rgba(59,130,246,0.28)" : "1px solid #E2E8F0",
                        background: "#FFFFFF",
                        boxShadow:  isOpen
                          ? "0 4px 16px rgba(59,130,246,0.08)"
                          : "0 1px 4px rgba(15,23,42,0.04)",
                        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : i)}
                        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-start"
                      >
                        <span
                          className="text-sm font-bold"
                          style={{ color: isOpen ? "#1D4ED8" : "#0F172A" }}
                        >
                          {q}
                        </span>
                        <ChevronDown
                          size={16}
                          style={{
                            color:      isOpen ? "#3B82F6" : "#94A3B8",
                            transform:  isOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            flexShrink: 0,
                          }}
                        />
                      </button>
                      {isOpen && (
                        <div
                          className="px-6 pb-5"
                          style={{ borderTop: "1px solid rgba(59,130,246,0.10)" }}
                        >
                          <p
                            className="text-sm leading-relaxed"
                            style={{ color: "#475569" }}
                          >
                            {a}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
