"use client";

import { useState } from "react";
import { arCount } from "@/lib/fmt";
import { Zap, CheckCircle, Loader2, Crown, Star, Sparkles, AlertTriangle, RefreshCw } from "lucide-react";
import {
  PLANS,
  PAID_PLANS,
  PLAN_NAMES_AR,
  PLAN_PRICES_EGP,
  featureRows,
  isUpgrade,
  planAtLeast,
  type Plan,
  type SubscriptionStatus,
} from "@/lib/plans";

interface SubscriptionPanelProps {
  plan:               Plan;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd:   string | null; // ISO date string
  effectivePlan:      Plan;
  daysUntilExpiry:    number | null; // null if no expiry date
}

const PLAN_ICONS = {
  FREE:    Star,
  PRO:     Zap,
  PREMIUM: Crown,
};

const PLAN_COLORS = {
  FREE:    "text-[var(--color-subtle)] bg-[var(--color-surface-2)]",
  PRO:     "text-[var(--color-jade)] bg-[var(--color-jade-soft)]",
  PREMIUM: "text-[var(--color-warn)] bg-[var(--color-warn-soft)]",
};

export default function SubscriptionPanel({
  plan,
  subscriptionStatus,
  currentPeriodEnd,
  effectivePlan,
  daysUntilExpiry,
}: SubscriptionPanelProps) {
  const [loading, setLoading] = useState<Plan | null>(null);
  const [error,   setError]   = useState<string | null>(null);

  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const isInactive     = subscriptionStatus === "INACTIVE" && plan !== "FREE";
  // Nothing left to sell them. Asked by rank so adding a tier above
  // PREMIUM does not quietly hide the upgrade panel from its buyers.
  const isTopPlan      = planAtLeast(effectivePlan, PLANS[PLANS.length - 1]);

  async function handleUpgrade(targetPlan: "PRO" | "PREMIUM") {
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

      {/* Expired / inactive banner */}
      {isInactive && (
        <div className="card p-5 bg-[var(--color-danger-soft)] border-[var(--color-danger-line)] border-2">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-[var(--color-danger)]">انتهى اشتراكك</p>
              <p className="text-sm text-[var(--color-danger)] mt-0.5">
                تم التحويل إلى الخطة المجانية. جدِّد اشتراكك الآن لاستعادة جميع المميزات.
              </p>
            </div>
            <button
              onClick={() => handleUpgrade(plan as "PRO" | "PREMIUM")}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-danger)] text-white text-sm font-bold hover:bg-[var(--color-danger)] transition-colors disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              تجديد
            </button>
          </div>
        </div>
      )}

      {/* Expiring soon warning */}
      {isExpiringSoon && !isInactive && (
        <div className="card p-5 bg-[var(--color-warn-soft)] border-[var(--color-warn-line)] border-2">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-[var(--color-star)] mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-[var(--color-warn)]">
                اشتراكك هينتهي خلال {arCount(daysUntilExpiry ?? 0, { one: "يوم واحد", two: "يومين", few: "أيام", many: "يوم" })}
              </p>
              <p className="text-sm text-[var(--color-warn)] mt-0.5">
                تاريخ الانتهاء: <span dir="ltr" className="font-medium">{currentPeriodEnd}</span>
              </p>
            </div>
            <button
              onClick={() => handleUpgrade(plan as "PRO" | "PREMIUM")}
              disabled={!!loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-warn)] text-white text-sm font-bold hover:bg-[var(--color-warn)] transition-colors disabled:opacity-50 shrink-0"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              تجديد الآن
            </button>
          </div>
        </div>
      )}

      {/* Current plan card */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center ${PLAN_COLORS[effectivePlan]}`}>
            {(() => { const Icon = PLAN_ICONS[effectivePlan]; return <Icon size={18} />; })()}
          </div>
          <div>
            <h2 className="font-bold text-[var(--color-text-primary)]">اشتراكك الحالي</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              باقة {PLAN_NAMES_AR[effectivePlan]}
              {isTrial && " (فترة تجريبية)"}
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
          {featureRows(effectivePlan).map(({ key, enabled, ar: label }) => {
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <CheckCircle
                  size={15}
                  className={enabled ? "text-[var(--color-ok)]" : "text-[var(--color-border)]"}
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
      {!isTopPlan && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={16} className="text-[var(--color-accent)]" />
            <h3 className="font-bold text-[var(--color-text-primary)]">ترقية الخطة</h3>
          </div>

          {error && (
            <div className="mb-4 bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-[var(--radius-md)] px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid gap-4">
            {PAID_PLANS.map((targetPlan) => {
              const isCurrentOrLower = !isUpgrade(effectivePlan, targetPlan);
              const PlanIcon = PLAN_ICONS[targetPlan];
              return (
                <div
                  key={targetPlan}
                  className={`border-2 rounded-[var(--radius-md)] p-4 transition-all ${
                    targetPlan === "PREMIUM"
                      ? "border-[var(--color-warn-line)] bg-[var(--color-warn-soft)]/30"
                      : "border-[var(--color-jade-line)] bg-[var(--color-jade-soft)]/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <PlanIcon size={16} className={targetPlan === "PREMIUM" ? "text-[var(--color-warn)]" : "text-[var(--color-jade)]"} />
                      <span className="font-bold text-[var(--color-text-primary)]">
                        {PLAN_NAMES_AR[targetPlan]}
                      </span>
                      {targetPlan === "PREMIUM" && (
                        <span className="text-[10px] bg-[var(--color-warn-soft)] text-[var(--color-warn)] px-1.5 py-0.5 rounded-full font-bold">
                          الأفضل
                        </span>
                      )}
                    </div>
                    <span className="font-extrabold text-lg text-[var(--color-text-primary)]" dir="ltr">
                      {PLAN_PRICES_EGP[targetPlan]} جنيه
                      <span className="text-xs font-normal text-[var(--color-text-muted)]">/شهر</span>
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {featureRows(targetPlan).map(({ key, enabled, ar: label }) => {
                      if (!enabled) return null;
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                          <CheckCircle size={12} className="text-[var(--color-ok)] shrink-0" />
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => handleUpgrade(targetPlan)}
                    disabled={!!loading || isCurrentOrLower}
                    className={`w-full py-2.5 rounded-[var(--radius-md)] text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                      targetPlan === "PREMIUM"
                        ? "bg-[var(--color-warn)] hover:bg-[var(--color-warn)] text-white"
                        : "bg-[var(--color-jade)] hover:bg-[var(--color-jade-hover)] text-white"
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

      {isTopPlan && (
        <div className="card p-5 bg-[var(--color-warn-soft)] border-[var(--color-warn-line)]">
          <div className="flex items-center gap-3">
            <Crown size={20} className="text-[var(--color-warn)]" />
            <div>
              <p className="font-bold text-[var(--color-warn)]">أنت على أعلى خطة</p>
              <p className="text-xs text-[var(--color-warn)] mt-0.5">
                معاك كل مميزات موعد
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
