"use client";

import Link from "next/link";
import { Check, X, Zap, Crown, Star } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import { PLAN_FEATURES, PLAN_PRICES_EGP, PLAN_NAMES_AR, PLAN_NAMES_EN } from "@/lib/plans";
import { useLanguage } from "@/contexts/LanguageContext";

type PlanId = "FREE" | "GROWTH" | "PRO";

const FEATURES_LIST_AR = [
  { key: "monthlyBookings" as const, label: "الحجوزات الشهرية" },
  { key: "whatsapp"        as const, label: "إشعارات واتساب للعملاء والعمل" },
  { key: "analytics"       as const, label: "لوحة الإحصائيات والتقارير" },
  { key: "deposits"        as const, label: "دفع العربون من العملاء (Paymob)" },
  { key: "customBranding"  as const, label: "إخفاء شعار موعد من صفحتك" },
];
const FEATURES_LIST_EN = [
  { key: "monthlyBookings" as const, label: "Monthly Bookings" },
  { key: "whatsapp"        as const, label: "WhatsApp Notifications (Customers & Business)" },
  { key: "analytics"       as const, label: "Analytics & Reports Dashboard" },
  { key: "deposits"        as const, label: "Customer Deposit Payments (Paymob)" },
  { key: "customBranding"  as const, label: "Remove Maw3ed Branding" },
];

const PLANS = [
  {
    id:        "FREE"   as PlanId,
    icon:      Star,
    color:     "text-gray-500",
    border:    "border-[var(--color-border)]",
    badge:     false,
    ctaHref:   "/signup",
    ctaClass:  "border-2 border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]",
    highlight: false,
  },
  {
    id:        "GROWTH" as PlanId,
    icon:      Zap,
    color:     "text-blue-600",
    border:    "border-blue-300",
    badge:     true,
    ctaHref:   "/dashboard/settings?tab=subscription",
    ctaClass:  "bg-blue-600 text-white hover:bg-blue-700",
    highlight: true,
  },
  {
    id:        "PRO"    as PlanId,
    icon:      Crown,
    color:     "text-amber-600",
    border:    "border-amber-300",
    badge:     false,
    ctaHref:   "/dashboard/settings?tab=subscription",
    ctaClass:  "bg-amber-500 text-white hover:bg-amber-600",
    highlight: false,
  },
];

function FeatureValue({
  planId, featureKey, unlimited, bookings,
}: {
  planId: PlanId;
  featureKey: keyof typeof PLAN_FEATURES.FREE;
  unlimited: string;
  bookings: string;
}) {
  const val = PLAN_FEATURES[planId][featureKey];
  if (featureKey === "monthlyBookings") {
    return (
      <span className="text-sm font-bold text-[var(--color-text-primary)]">
        {val === Infinity ? unlimited : `${val} ${bookings}`}
      </span>
    );
  }
  return val ? (
    <Check size={18} className="text-green-500 mx-auto" />
  ) : (
    <X size={18} className="text-[var(--color-border)] mx-auto" />
  );
}

export default function PricingPage() {
  const { t, lang } = useLanguage();
  const p = t.pricing;
  const featuresList = lang === "en" ? FEATURES_LIST_EN : FEATURES_LIST_AR;
  const planNames = lang === "en" ? PLAN_NAMES_EN : PLAN_NAMES_AR;

  const planCtas: Record<PlanId, string> = {
    FREE:   lang === "en" ? "Start Free"          : "ابدأ مجانًا",
    GROWTH: lang === "en" ? "Start Growing"       : "ابدأ بالنمو",
    PRO:    lang === "en" ? "Upgrade to Pro"      : "الترقية للاحترافي",
  };

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <PageHero
          badge={p.eyebrow}
          title={p.title}
          subtitle={p.subtitle}
          dir={lang === "ar" ? "rtl" : "ltr"}
        />

        {/* Plan cards */}
        <div className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const Icon = plan.icon;
              return (
                <div
                  key={plan.id}
                  className={`relative card p-6 flex flex-col border-2 ${plan.border} ${plan.highlight ? "shadow-lg scale-[1.02]" : ""}`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 right-6 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {p.mostPopular}
                    </div>
                  )}

                  <div className="mb-6">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                      plan.id === "FREE" ? "bg-gray-100" : plan.id === "GROWTH" ? "bg-blue-100" : "bg-amber-100"
                    }`}>
                      <Icon size={20} className={plan.color} />
                    </div>
                    <h2 className="text-lg font-black text-[var(--color-text-primary)]">
                      {planNames[plan.id]}
                    </h2>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[var(--color-text-primary)]">
                        {PLAN_PRICES_EGP[plan.id] === 0
                          ? (lang === "en" ? "Free" : "مجاني")
                          : PLAN_PRICES_EGP[plan.id].toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
                      </span>
                      {PLAN_PRICES_EGP[plan.id] > 0 && (
                        <span className="text-sm text-[var(--color-text-muted)]">
                          {lang === "en" ? "EGP / mo" : "ج.م / شهر"}
                        </span>
                      )}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {featuresList.map(({ key, label }) => {
                      const val     = PLAN_FEATURES[plan.id][key];
                      const enabled = typeof val === "boolean" ? val : true;
                      const display = key === "monthlyBookings"
                        ? (val === Infinity ? p.unlimited : `${val} ${p.bookings}`)
                        : label;
                      return (
                        <li key={key} className="flex items-center gap-2.5 text-sm">
                          {enabled ? (
                            <Check size={15} className="text-green-500 shrink-0" />
                          ) : (
                            <X size={15} className="text-[var(--color-border)] shrink-0" />
                          )}
                          <span className={enabled ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}>
                            {display}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className={`block text-center py-3 rounded-xl text-sm font-bold transition-colors ${plan.ctaClass}`}
                  >
                    {planCtas[plan.id]}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Feature comparison table (desktop) */}
          <div className="mt-16 hidden md:block">
            <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-6 text-center">
              {p.comparison}
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-start p-4 text-[var(--color-text-muted)] font-medium w-1/2">
                      {p.feature}
                    </th>
                    {PLANS.map((pl) => (
                      <th key={pl.id} className="text-center p-4 font-black text-[var(--color-text-primary)]">
                        {planNames[pl.id]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featuresList.map(({ key, label }, i) => (
                    <tr key={key} className={i % 2 === 0 ? "bg-[var(--color-surface-2)]" : ""}>
                      <td className="p-4 text-[var(--color-text-secondary)]">{label}</td>
                      {PLANS.map((pl) => (
                        <td key={pl.id} className="p-4 text-center">
                          <FeatureValue
                            planId={pl.id}
                            featureKey={key}
                            unlimited={p.unlimited}
                            bookings={p.bookings}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-16 max-w-2xl mx-auto space-y-4">
            <h2 className="text-xl font-black text-[var(--color-text-primary)] text-center mb-6">
              {p.faqTitle}
            </h2>
            {p.faqs.map(({ q, a }) => (
              <div key={q} className="card p-5">
                <p className="font-bold text-[var(--color-text-primary)] mb-1.5">{q}</p>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
