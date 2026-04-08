"use client";

import { useState } from "react";
import { Zap, CheckCircle, Loader2, Crown, Star, Sparkles } from "lucide-react";
import {
  PLAN_FEATURES,
  PLAN_NAMES_AR,
  PLAN_PRICES_EGP,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/plans";

interface SubscriptionPanelProps {
  plan:               Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd:   string | null; // ISO date string
  effectivePlan:      Plan;
}

const PLAN_ICONS = {
  FREE:   Star,
  GROWTH: Zap,
  PRO:    Crown,
};

const PLAN_COLORS = {
  FREE:   "text-gray-500 bg-gray-50",
  GROWTH: "text-blue-600 bg-blue-50",
  PRO:    "text-amber-600 bg-amber-50",
};

const FEATURE_LABELS: Record<keyof typeof PLAN_FEATURES.FREE, string> = {
  monthlyBookings: "حجوزات شهرية",
  whatsapp:        "إشعارات واتساب",
  deposits:        "دفع عربون من العملاء",
  analytics:       "لوحة الإحصائيات",
  customBranding:  "إخفاء شعار موعد",
};

export default function SubscriptionPanel({
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  effectivePlan,
}: SubscriptionPanelProps) {
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  async function handleUpgrade(targetPlan: "GROWTH" | "PRO") {
    setLoading(targetPlan);
    setError(null);
    try {
      const res  = await fetch("/api/business/subscription/upgrade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ plan: targetPlan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "حدث خطأ أثناء بدء عملية الدفع");
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("تعذّر الاتصال بالخادم");
    } finally {
      setLoading(null);
    }
  }

  const isTrial = subscriptionStatus === "TRIAL";

  return (
    <div className="space-y-6">
      {/* Current plan card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${PLAN_COLORS[effectivePlan]}`}>
            {(() => { const Icon = PLAN_ICONS[effectivePlan]; return <Icon size={18} />; })()}
          </div>
          <div>
            <h2 className="font-bold text-[var(--color-text-primary)]">اشتراكك الحالي</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              خطة {PLAN_NAMES_AR[effectivePlan]}
              {isTrial && " (تجريبي)"}
            </p>
          </div>
          <span className={`ms-auto text-xs font-bold px-2.5 py-1 rounded-full ${PLAN_COLORS[effectivePlan]}`}>
            {PLAN_NAMES_AR[effectivePlan]}
          </span>
        </div>

        {currentPeriodEnd && subscriptionStatus === "ACTIVE" && plan !== "FREE" && (
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            تجديد الاشتراك بتاريخ{" "}
            <span dir="ltr" className="font-medium text-[var(--color-text-secondary)]">
              {currentPeriodEnd}
            </span>
          </p>
        )}

        {/* Feature list for current plan */}
        <div className="space-y-2">
          {(Object.keys(FEATURE_LABELS) as Array<keyof typeof PLAN_FEATURES.FREE>).map((key) => {
            const val     = PLAN_FEATURES[effectivePlan][key];
            const enabled = typeof val === "boolean" ? val : true;
            const label   = key === "monthlyBookings"
              ? `${val === Infinity ? "غير محدودة" : val} حجوزات شهرية`
              : FEATURE_LABELS[key];
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <CheckCircle
                  size={15}
                  className={enabled ? "text-green-500" : "text-[var(--color-border)]"}
                />
                <span className={enabled ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] line-through"}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade options */}
      {effectivePlan !== "PRO" && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-[var(--color-text-primary)]">ترقية الخطة</h3>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            {(["GROWTH", "PRO"] as const).map((targetPlan) => {
              const isCurrentOrLower = effectivePlan === targetPlan || (effectivePlan === "PRO");
              const PlanIcon = PLAN_ICONS[targetPlan];
              return (
                <div
                  key={targetPlan}
                  className={`border-2 rounded-xl p-4 transition-all ${
                    targetPlan === "PRO"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-blue-200 bg-blue-50/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PlanIcon size={16} className={targetPlan === "PRO" ? "text-amber-600" : "text-blue-600"} />
                      <span className="font-bold text-[var(--color-text-primary)]">
                        {PLAN_NAMES_AR[targetPlan]}
                      </span>
                      {targetPlan === "PRO" && (
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                          الأفضل
                        </span>
                      )}
                    </div>
                    <span className="font-black text-lg text-[var(--color-text-primary)]" dir="ltr">
                      {PLAN_PRICES_EGP[targetPlan]} جنيه
                      <span className="text-xs font-normal text-[var(--color-text-muted)]">/شهر</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {(Object.keys(FEATURE_LABELS) as Array<keyof typeof PLAN_FEATURES.FREE>).map((key) => {
                      const val     = PLAN_FEATURES[targetPlan][key];
                      const enabled = typeof val === "boolean" ? val : true;
                      const label   = key === "monthlyBookings"
                        ? `${val === Infinity ? "غير محدودة" : val} حجوزات شهرية`
                        : FEATURE_LABELS[key];
                      if (!enabled) return null;
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                          <CheckCircle size={12} className="text-green-500 shrink-0" />
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleUpgrade(targetPlan)}
                    disabled={!!loading || isCurrentOrLower}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      targetPlan === "PRO"
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-blue-500 hover:bg-blue-600 text-white"
                    }`}
                  >
                    {loading === targetPlan ? (
                      <><Loader2 size={14} className="animate-spin" /> جارٍ التحويل…</>
                    ) : isCurrentOrLower ? (
                      "خطتك الحالية"
                    ) : (
                      `الترقية إلى ${PLAN_NAMES_AR[targetPlan]}`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {effectivePlan === "PRO" && (
        <div className="card p-5 bg-amber-50 border-amber-200">
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-amber-600" />
            <div>
              <p className="font-bold text-amber-800">أنت على أعلى خطة</p>
              <p className="text-xs text-amber-700 mt-0.5">
                تستمتع بجميع مميزات موعد الاحترافية
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
