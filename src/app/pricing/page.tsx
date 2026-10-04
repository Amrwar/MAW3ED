"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Zap, Crown, Sparkles, ChevronDown, MessageCircle, ArrowRight, ArrowLeft } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { PLAN_FEATURES, PLAN_PRICES_EGP, PLAN_NAMES_AR, PLAN_NAMES_EN } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

type PlanId = "FREE" | "PRO" | "PREMIUM";

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
    iconBg:    "linear-gradient(135deg, var(--color-surface-3) 0%, var(--color-line) 100%)",
    iconColor: "var(--color-muted)",
    featured:  false,
    ctaHref:   "/signup",
    descAr:    "للمبتدئين والتجربة",
    descEn:    "For getting started",
  },
  PRO: {
    icon:      Zap,
    iconBg:    "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
    iconColor: "var(--color-surface)",
    featured:  true,
    ctaHref:   "/dashboard/settings?tab=subscription",
    descAr:    "للأعمال في مرحلة النمو",
    descEn:    "For growing businesses",
  },
  PREMIUM: {
    icon:      Crown,
    iconBg:    "var(--color-night)",
    iconColor: "var(--color-surface)",
    featured:  false,
    ctaHref:   "/dashboard/settings?tab=subscription",
    descAr:    "للأعمال الاحترافية",
    descEn:    "For established businesses",
  },
};

const PLAN_ORDER: PlanId[] = ["FREE", "PRO", "PREMIUM"];

// ─── Feature icon helpers ─────────────────────────────────────────────────

function CheckCircle() {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "var(--color-ok-soft)" }}
    >
      <Check size={11} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
    </div>
  );
}

function MinusCircle() {
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
      style={{ background: "var(--color-surface-3)" }}
    >
      <Minus size={11} strokeWidth={2} style={{ color: "var(--color-line-2)" }} />
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
    FREE:    isAr ? "ابدأ مجانًا"       : "Start Free",
    PRO:     isAr ? "ابدأ بالاحترافي"  : "Get Started",
    PREMIUM: isAr ? "الترقية للمميز"   : "Upgrade to Premium",
  };

  const trustItems = isAr
    ? ["بدون بطاقة ائتمان", "إلغاء في أي وقت", "إعداد في 5 دقائق"]
    : ["No credit card required", "Cancel anytime", "5-minute setup"];

  return (
    <>
      <Navbar />
      <main className="min-h-screen" style={{ background: "var(--color-surface-2)" }}>

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
                "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(14,127,94,0.07) 0%, transparent 100%)",
            }}
          />

          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-20 relative z-10">

            {/* ── Plan cards ──────────────────────────────── */}
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 items-start">
              {PLAN_ORDER.map((planId) => {
                const cfg    = PLANS_CONFIG[planId];
                const Icon   = cfg.icon;
                const price  = PLAN_PRICES_EGP[planId];
                const isFree = price === 0;
                const { featured } = cfg;

                return (
                  <div
                    key={planId}
                    className="relative flex flex-col rounded-3xl bg-white overflow-hidden transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                    style={{
                      border: featured
                        ? "1px solid rgba(14,127,94,0.38)"
                        : "1px solid var(--color-line)",
                      boxShadow: featured
                        ? "0 0 0 4px rgba(14,127,94,0.08), 0 24px 64px rgba(14,127,94,0.14), 0 8px 24px rgba(17,32,28,0.06)"
                        : "0 1px 4px rgba(17,32,28,0.04), 0 4px 16px rgba(17,32,28,0.04)",
                      transform: featured ? "translateY(-10px)" : "translateY(0)",
                      transition: "box-shadow 0.25s ease, transform 0.25s ease",
                    }}
                  >

                    {/* Blue top accent bar (featured only) */}
                    {featured && (
                      <div
                        className="h-1 w-full shrink-0"
                        style={{
                          background:
                            "linear-gradient(90deg, var(--color-jade) 0%, var(--color-jade) 50%, var(--color-jade) 100%)",
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
                              "linear-gradient(135deg, rgba(10,95,71,0.10) 0%, rgba(14,127,94,0.10) 100%)",
                            border: "1px solid rgba(14,127,94,0.25)",
                          }}
                        >
                          <Zap size={10} style={{ color: "var(--color-jade)" }} />
                          <span
                            className="font-bold uppercase"
                            style={{
                              color: "var(--color-jade-hover)",
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
                            className="text-base font-extrabold text-[var(--color-ink)]"
                            style={{ letterSpacing: "-0.015em" }}
                          >
                            {planNames[planId]}
                          </h2>
                          <p className="text-xs text-[var(--color-subtle)] mt-0.5">
                            {isAr ? cfg.descAr : cfg.descEn}
                          </p>
                        </div>
                      </div>

                      {/* Price block */}
                      <div className="mb-7">
                        {isFree ? (
                          <p
                            className="text-4xl font-extrabold"
                            style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
                          >
                            {isAr ? "مجاني" : "Free"}
                          </p>
                        ) : (
                          <>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className="text-4xl font-extrabold"
                                style={{
                                  color: featured ? "var(--color-jade)" : "var(--color-ink)",
                                  letterSpacing: "-0.03em",
                                }}
                              >
                                {price.toLocaleString(isAr ? "ar-EG-u-nu-latn" : "en-US")}
                              </span>
                              <span className="text-sm font-semibold text-[var(--color-subtle)]">
                                {isAr ? "ج.م" : "EGP"}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--color-subtle)] mt-1">
                              {isAr ? "شهريًا · يُجدَّد تلقائيًا" : "per month · auto-renewed"}
                            </p>
                          </>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="h-px mb-7" style={{ background: "var(--color-surface-3)" }} />

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
                                style={{ color: enabled ? "var(--color-ink-2)" : "var(--color-subtle)" }}
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
                          className="block text-center py-3 rounded-2xl text-sm font-bold transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                          style={{
                            background:  "var(--color-surface-2)",
                            border:      "1.5px solid var(--color-line)",
                            color:       "var(--color-muted)",
                          }}
                        >
                          {planCtas[planId]}
                        </Link>
                      )}

                      {planId === "PRO" && (
                        <Link
                          href={cfg.ctaHref}
                          className="block text-center py-3 rounded-2xl text-sm font-bold text-white transition-all duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                          style={{
                            background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                            boxShadow:  "0 4px 16px rgba(14,127,94,0.40)",
                          }}
                        >
                          {planCtas[planId]}
                        </Link>
                      )}

                      {planId === "PREMIUM" && (
                        <Link href={cfg.ctaHref} className="btn btn-night w-full">
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
                  <Check size={13} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
                  <span className="text-xs font-medium text-[var(--color-muted)]">{item}</span>
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
                  className="text-2xl font-extrabold text-[var(--color-ink)]"
                  style={{ letterSpacing: "-0.025em" }}
                >
                  {p.comparison}
                </h2>
              </div>

              {/* Table card */}
              <div
                className="overflow-hidden rounded-3xl"
                style={{
                  border:     "1px solid var(--color-line)",
                  boxShadow:  "0 4px 24px rgba(17,32,28,0.06), 0 1px 4px rgba(17,32,28,0.03)",
                }}
              >
                {/* Horizontal scroll wrapper for mobile */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ minWidth: 520 }}>

                    {/* Dark navy header */}
                    <thead>
                      <tr style={{ background: "var(--color-ink)" }}>
                        <th
                          className="text-start px-6 py-5 font-semibold"
                          style={{ color: "var(--color-muted)", width: "42%" }}
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
                                background: cfg.featured ? "var(--color-jade)" : "transparent",
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
                                    style={{ color: "var(--color-surface)" }}
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
                            className="px-6 py-4 font-medium text-[var(--color-ink)]"
                            style={{
                              background:   i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-2)",
                              borderBottom: "1px solid var(--color-surface-3)",
                            }}
                          >
                            {label}
                          </td>

                          {/* Plan cells */}
                          {PLAN_ORDER.map((planId) => {
                            const cfg = PLANS_CONFIG[planId];
                            const val = PLAN_FEATURES[planId][key];

                            const rowBg = i % 2 === 0 ? "var(--color-surface)" : "var(--color-surface-2)";
                            const cellBg = cfg.featured
                              ? i % 2 === 0
                                ? "rgba(14,127,94,0.05)"
                                : "rgba(14,127,94,0.03)"
                              : rowBg;

                            let content: React.ReactNode;
                            if (key === "monthlyBookings") {
                              content = (
                                <span
                                  className="font-bold"
                                  style={{ color: cfg.featured ? "var(--color-jade)" : "var(--color-ink)" }}
                                >
                                  {val === Infinity ? p.unlimited : `${val} ${p.bookings}`}
                                </span>
                              );
                            } else if (val) {
                              content = (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                                  style={{ background: "var(--color-ok-soft)" }}
                                >
                                  <Check size={12} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
                                </div>
                              );
                            } else {
                              content = (
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
                                  style={{ background: "var(--color-surface-3)" }}
                                >
                                  <Minus size={12} strokeWidth={2} style={{ color: "var(--color-line-2)" }} />
                                </div>
                              );
                            }

                            return (
                              <td
                                key={planId}
                                className="px-4 py-4 text-center"
                                style={{
                                  background:   cellBg,
                                  borderBottom: "1px solid var(--color-surface-3)",
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
                FAQ section — premium branded block
            ══════════════════════════════════════════════ */}
            <div className="mt-24">

              {/* Outer surface card */}
              <div
                className="relative overflow-hidden rounded-3xl"
                style={{
                  background: "linear-gradient(135deg, rgba(14,127,94,0.04) 0%, rgba(14,127,94,0.025) 100%)",
                  border:     "1px solid rgba(14,127,94,0.13)",
                  boxShadow:  "0 2px 20px rgba(14,127,94,0.06), 0 1px 4px rgba(17,32,28,0.03)",
                }}
              >
                {/* Dot-grid texture */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(14,127,94,0.055) 1px, transparent 1px)",
                    backgroundSize:  "22px 22px",
                  }}
                />

                <div className="relative z-10 p-8 lg:p-12">
                  {/* Two-column: heading + support CTA | accordion */}
                  <div className="grid lg:grid-cols-[1fr_1.5fr] gap-10 lg:gap-14 items-start">

                    {/* ── Left: heading + support CTA ── */}
                    <div>

                      {/* Eyebrow badge */}
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--color-jade)]/25 bg-[var(--color-jade)]/10 mb-5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-jade)]" />
                        <span
                          className="font-semibold uppercase"
                          style={{ color: "var(--color-jade-hover)", fontSize: 11, letterSpacing: "0.07em" }}
                        >
                          {isAr ? "أسئلة شائعة" : "FAQ"}
                        </span>
                      </div>

                      {/* Heading */}
                      <h2
                        className="text-2xl lg:text-3xl font-extrabold text-[var(--color-ink)] mb-3"
                        style={{ letterSpacing: "-0.025em", lineHeight: 1.15 }}
                      >
                        {p.faqTitle}
                      </h2>

                      {/* Subtitle */}
                      <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-8">
                        {isAr
                          ? "إجابات على الأسئلة الأكثر شيوعًا حول خطط وأسعار موعد."
                          : "Answers to the most common questions about Maw3ed plans and pricing."}
                      </p>

                      {/* Support CTA card */}
                      <div
                        className="rounded-2xl p-5"
                        style={{
                          background: "var(--color-surface)",
                          border:     "1px solid var(--color-line)",
                          boxShadow:  "0 1px 4px rgba(17,32,28,0.05)",
                        }}
                      >
                        {/* Icon */}
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                          style={{
                            background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                            boxShadow:  "0 4px 12px rgba(14,127,94,0.30)",
                          }}
                        >
                          <MessageCircle size={18} className="text-white" strokeWidth={1.75} />
                        </div>

                        <p
                          className="text-sm font-bold text-[var(--color-ink)] mb-1"
                          style={{ letterSpacing: "-0.01em" }}
                        >
                          {isAr ? "لم تجد ما تبحث عنه؟" : "Still have questions?"}
                        </p>
                        <p className="text-xs text-[var(--color-subtle)] mb-4" style={{ lineHeight: 1.6 }}>
                          {isAr
                            ? "فريق الدعم جاهز لمساعدتك في اختيار الخطة المناسبة."
                            : "Our support team is ready to help you choose the right plan."}
                        </p>

                        <Link
                          href="/contact"
                          className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors duration-150 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                          style={{ color: "var(--color-jade)" }}
                        >
                          {isAr ? "تواصل مع الدعم" : "Contact support"}
                          {isAr
                            ? <ArrowLeft  size={12} strokeWidth={2.5} />
                            : <ArrowRight size={12} strokeWidth={2.5} />}
                        </Link>
                      </div>
                    </div>

                    {/* ── Right: accordion ── */}
                    <div className="space-y-3">
                      {p.faqs.map(({ q, a }, i) => {
                        const isOpen = openFaq === i;
                        return (
                          <div
                            key={i}
                            className="rounded-3xl bg-white overflow-hidden"
                            style={{
                              border:     isOpen
                                ? "1.5px solid rgba(14,127,94,0.32)"
                                : "1px solid var(--color-line)",
                              boxShadow:  isOpen
                                ? "0 4px 20px rgba(14,127,94,0.10), 0 1px 4px rgba(17,32,28,0.04)"
                                : "0 1px 3px rgba(17,32,28,0.04)",
                              borderInlineStart: isOpen
                                ? "3px solid var(--color-jade)"
                                : undefined,
                              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                            }}
                          >
                            {/* Question trigger */}
                            <button
                              type="button"
                              onClick={() => setOpenFaq(isOpen ? null : i)}
                              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-start"
                            >
                              <span
                                className="text-[15px] font-bold leading-snug"
                                style={{ color: isOpen ? "var(--color-jade)" : "var(--color-ink)" }}
                              >
                                {q}
                              </span>

                              {/* Chevron pill */}
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                style={{
                                  background:  isOpen ? "var(--color-jade-soft)" : "var(--color-surface-3)",
                                  transition:  "background 0.2s ease",
                                  flexShrink:  0,
                                }}
                              >
                                <ChevronDown
                                  size={14}
                                  style={{
                                    color:      isOpen ? "var(--color-jade-hover)" : "var(--color-subtle)",
                                    transform:  isOpen ? "rotate(180deg)" : "rotate(0deg)",
                                    transition: "transform 0.25s ease, color 0.2s ease",
                                  }}
                                />
                              </div>
                            </button>

                            {/* Answer — CSS grid-rows animation (no JS height calc) */}
                            <div
                              style={{
                                display:           "grid",
                                gridTemplateRows:  isOpen ? "1fr" : "0fr",
                                transition:        "grid-template-rows 0.25s ease",
                              }}
                            >
                              <div style={{ overflow: "hidden" }}>
                                <div
                                  className="px-6 pb-6"
                                  style={{ borderTop: "1px solid rgba(14,127,94,0.08)" }}
                                >
                                  <p
                                    className="text-sm pt-4"
                                    style={{ color: "var(--color-muted)", lineHeight: 1.75 }}
                                  >
                                    {a}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
