import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Zap, Crown, Star, ArrowLeft } from "lucide-react";
import { PLAN_FEATURES, PLAN_PRICES_EGP, PLAN_NAMES_AR } from "@/lib/plans";

export const metadata: Metadata = { title: "الأسعار والخطط | موعد" };

const FEATURES_LIST = [
  { key: "monthlyBookings" as const, label: "الحجوزات الشهرية" },
  { key: "whatsapp"        as const, label: "إشعارات واتساب للعملاء والعمل" },
  { key: "analytics"       as const, label: "لوحة الإحصائيات والتقارير" },
  { key: "deposits"        as const, label: "دفع العربون من العملاء (Paymob)" },
  { key: "customBranding"  as const, label: "إخفاء شعار موعد من صفحتك" },
];

const PLANS = [
  {
    id:          "FREE"   as const,
    icon:        Star,
    color:       "text-gray-500",
    border:      "border-[var(--color-border)]",
    badge:       "",
    ctaLabel:    "ابدأ مجانًا",
    ctaHref:     "/signup",
    ctaClass:    "border-2 border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]",
    highlight:   false,
  },
  {
    id:          "GROWTH" as const,
    icon:        Zap,
    color:       "text-blue-600",
    border:      "border-blue-300",
    badge:       "الأكثر طلبًا",
    ctaLabel:    "ابدأ بالنمو",
    ctaHref:     "/dashboard/settings?tab=subscription",
    ctaClass:    "bg-blue-600 text-white hover:bg-blue-700",
    highlight:   true,
  },
  {
    id:          "PRO"    as const,
    icon:        Crown,
    color:       "text-amber-600",
    border:      "border-amber-300",
    badge:       "",
    ctaLabel:    "الترقية للاحترافي",
    ctaHref:     "/dashboard/settings?tab=subscription",
    ctaClass:    "bg-amber-500 text-white hover:bg-amber-600",
    highlight:   false,
  },
];

function FeatureValue({ planId, featureKey }: { planId: "FREE" | "GROWTH" | "PRO"; featureKey: keyof typeof PLAN_FEATURES.FREE }) {
  const val = PLAN_FEATURES[planId][featureKey];
  if (featureKey === "monthlyBookings") {
    return (
      <span className="text-sm font-bold text-[var(--color-text-primary)]">
        {val === Infinity ? "غير محدودة" : `${val} حجز`}
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
  return (
    <div className="min-h-screen bg-[var(--color-bg)]" dir="rtl">
      {/* Header */}
      <div className="text-center py-16 px-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-8 transition-colors"
        >
          <ArrowLeft size={14} />
          العودة للرئيسية
        </Link>
        <h1 className="text-3xl md:text-4xl font-black text-[var(--color-text-primary)] mb-3">
          خطط بسيطة وشفافة
        </h1>
        <p className="text-[var(--color-text-muted)] text-lg max-w-xl mx-auto">
          ابدأ مجانًا، وقم بالترقية عندما تكون جاهزًا. لا رسوم خفية.
        </p>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.id}
                className={`relative card p-6 flex flex-col border-2 ${plan.border} ${
                  plan.highlight ? "shadow-lg scale-[1.02]" : ""
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 right-6 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    plan.id === "FREE"   ? "bg-gray-100"   :
                    plan.id === "GROWTH" ? "bg-blue-100"   : "bg-amber-100"
                  }`}>
                    <Icon size={20} className={plan.color} />
                  </div>
                  <h2 className="text-lg font-black text-[var(--color-text-primary)]">
                    {PLAN_NAMES_AR[plan.id]}
                  </h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-[var(--color-text-primary)]">
                      {PLAN_PRICES_EGP[plan.id] === 0 ? "مجاني" : PLAN_PRICES_EGP[plan.id].toLocaleString("ar-EG")}
                    </span>
                    {PLAN_PRICES_EGP[plan.id] > 0 && (
                      <span className="text-sm text-[var(--color-text-muted)]">جنيه / شهر</span>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-6">
                  {FEATURES_LIST.map(({ key, label }) => {
                    const val     = PLAN_FEATURES[plan.id][key];
                    const enabled = typeof val === "boolean" ? val : true;
                    const display = key === "monthlyBookings"
                      ? (val === Infinity ? "غير محدودة" : `${val} حجز / شهر`)
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

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  className={`block text-center py-3 rounded-xl text-sm font-bold transition-colors ${plan.ctaClass}`}
                >
                  {plan.ctaLabel}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature comparison table (desktop) */}
        <div className="mt-16 hidden md:block">
          <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-6 text-center">
            مقارنة تفصيلية
          </h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-start p-4 text-[var(--color-text-muted)] font-medium w-1/2">الميزة</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="text-center p-4 font-black text-[var(--color-text-primary)]">
                      {PLAN_NAMES_AR[p.id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES_LIST.map(({ key, label }, i) => (
                  <tr
                    key={key}
                    className={i % 2 === 0 ? "bg-[var(--color-surface-2)]" : ""}
                  >
                    <td className="p-4 text-[var(--color-text-secondary)]">{label}</td>
                    {PLANS.map((p) => (
                      <td key={p.id} className="p-4 text-center">
                        <FeatureValue planId={p.id} featureKey={key} />
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
            أسئلة شائعة
          </h2>
          {[
            {
              q: "هل يمكنني إلغاء الاشتراك؟",
              a: "نعم، يمكنك التوقف عن التجديد في أي وقت. ستستمر مميزات خطتك حتى نهاية فترة الاشتراك.",
            },
            {
              q: "كيف يتم الدفع؟",
              a: "يتم الدفع شهريًا عبر بوابة Paymob الآمنة. نقبل بطاقات الائتمان والمحافظ الإلكترونية.",
            },
            {
              q: "ماذا يحدث إذا تجاوزت الحد الشهري للحجوزات في الخطة المجانية؟",
              a: "سيتوقف قبول الحجوزات الجديدة حتى بداية الشهر التالي أو حتى ترقية خطتك.",
            },
            {
              q: "هل البيانات الخاصة بي آمنة؟",
              a: "نعم، جميع البيانات مشفرة ومحمية. لا نشارك بياناتك مع أي طرف ثالث.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="card p-5">
              <p className="font-bold text-[var(--color-text-primary)] mb-1.5">{q}</p>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
