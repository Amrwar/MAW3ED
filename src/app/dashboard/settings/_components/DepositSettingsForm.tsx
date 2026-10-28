"use client";

import { useState } from "react";
import { Loader2, CreditCard, Info, Lock, Check, X } from "lucide-react";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

interface DepositSettingsFormProps {
  initialEnabled:  boolean;
  initialPercent:  number;
  canUseDeposits?: boolean;
}

const card: React.CSSProperties = {
  background:   "var(--color-surface)",
  border:       "1.5px solid var(--color-line)",
  borderRadius: 20,
  boxShadow:    "0 1px 6px rgba(17,32,28,0.05)",
  overflow:     "hidden",
};

const cardHead: React.CSSProperties = {
  display:       "flex",
  alignItems:    "center",
  gap:           12,
  padding:       "14px 22px",
  background:    "var(--color-ground)",
  borderBottom:  "1px solid var(--color-surface-3)",
};

export default function DepositSettingsForm({
  initialEnabled,
  initialPercent,
  canUseDeposits = true,
}: DepositSettingsFormProps) {
  const [enabled,  setEnabled]  = useState(initialEnabled);
  const [percent,  setPercent]  = useState(initialPercent);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const { lang } = useLanguage();
  const isAr = lang === "ar";

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res  = await fetch("/api/business/settings/deposit", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ depositEnabled: enabled, depositPercent: percent }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? (isAr ? "حدث خطأ أثناء الحفظ" : "An error occurred while saving"));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(isAr ? "تعذّر الاتصال بالخادم" : "Could not connect to server");
    } finally {
      setSaving(false);
    }
  }

  // ── Locked state for FREE plan ──────────────────────────
  if (!canUseDeposits) {
    return (
      <div style={card}>
        <div style={cardHead}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: "var(--color-warn-soft)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Lock size={14} style={{ color: "var(--color-warn)" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
              {isAr ? "إعدادات العربون" : "Deposit Settings"}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 1 }}>
              {isAr ? "متاح في باقة الاحترافي وما فوقها" : "Available on Pro and above"}
            </p>
          </div>
        </div>
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div
            className="w-16 h-16 rounded-[var(--radius-lg)] flex items-center justify-center mx-auto mb-5"
            style={{ background: "var(--color-warn-soft)", border: "1.5px solid var(--color-warn-line)" }}
          >
            <Lock size={26} style={{ color: "var(--color-warn)" }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--color-ink)", marginBottom: 8 }}>
            {isAr ? "ميزة العربون" : "Deposits"}
          </h2>
          <p
            style={{
              fontSize: 13, color: "var(--color-muted)", lineHeight: 1.7,
              maxWidth: 340, margin: "0 auto 24px",
            }}
          >
            {isAr ? (
              <>
                العربون متاح في باقة{" "}
                <strong style={{ color: "var(--color-warn)" }}>الاحترافي</strong> وما فوقها.
                طوّر باقتك عشان تبدأ تستقبل عربون من عملائك وقت الحجز.
              </>
            ) : (
              <>
                Deposits are available on the{" "}
                <strong style={{ color: "var(--color-warn)" }}>Pro plan</strong> and above.
                Upgrade to start taking a deposit from customers when they book.
              </>
            )}
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] font-bold text-white transition-colors text-[0.8125rem]"
            style={{
              padding:    "10px 24px",
              background: "linear-gradient(135deg, var(--color-warn) 0%, var(--color-star) 100%)",
              boxShadow:  "0 3px 12px rgba(217,119,6,0.3)" }}
          >
            {isAr ? "عرض الخطط والأسعار" : "View Plans & Pricing"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Main settings card ──────────────────────────────── */}
      <div style={card}>
        <div style={cardHead}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: "var(--color-jade-tint)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <CreditCard size={14} style={{ color: "var(--color-jade)" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--color-ink)" }}>
              {isAr ? "إعدادات العربون" : "Deposit Settings"}
            </p>
            <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 1 }}>
              {isAr ? "اطلب من العملاء دفع عربون لتأكيد الحجز" : "Require customers to pay a deposit to confirm their booking"}
            </p>
          </div>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Enable toggle row */}
          <div
            className="flex items-center justify-between rounded-[var(--radius-md)] px-4 py-4 cursor-pointer transition-all"
            style={{
              background: enabled ? "var(--color-ok-soft)" : "var(--color-surface-2)",
              border:     `1.5px solid ${enabled ? "var(--color-ok-line)" : "var(--color-line)"}`,
              transition: "background 0.2s, border-color 0.2s",
            }}
            onClick={() => setEnabled((v) => !v)}
          >
            <div className="flex-1">
              <p
                style={{
                  fontSize:   13,
                  fontWeight: 700,
                  color:      enabled ? "var(--color-ok)" : "var(--color-muted)",
                  marginBottom: 2,
                }}
              >
                {enabled
                  ? (isAr ? "العربون مفعّل" : "Deposit enabled")
                  : (isAr ? "العربون معطّل" : "Deposit disabled")}
              </p>
              <p style={{ fontSize: 11, color: "var(--color-subtle)" }}>
                {enabled
                  ? (isAr ? "لن يُؤكَّد الحجز إلا بعد دفع العربون" : "Booking won't be confirmed until deposit is paid")
                  : (isAr ? "عند التفعيل، سيُطلب من العملاء دفع عربون" : "When enabled, customers will be asked to pay a deposit")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={(e) => { e.stopPropagation(); setEnabled((v) => !v); }}
              style={{
                width:        44,
                height:       24,
                borderRadius: 12,
                background:   enabled ? "var(--color-ok)" : "var(--color-line-2)",
                position:     "relative",
                flexShrink:   0,
                transition:   "background 0.2s",
                border:       "none",
                cursor:       "pointer",
                marginInlineStart: 14,
              }}
            >
              <span
                style={{
                  position:   "absolute",
                  width:      18,
                  height:     18,
                  borderRadius: "50%",
                  background: "var(--color-surface)",
                  boxShadow:  "0 1px 4px rgba(17,32,28,0.2)",
                  top:        3,
                  left:       enabled ? 23 : 3,
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>

          {/* Percentage — only when enabled */}
          {enabled && (
            <div>
              <label
                style={{
                  fontSize:   12,
                  fontWeight: 600,
                  color:      "var(--color-ink-2)",
                  display:    "block",
                  marginBottom: 8,
                }}
              >
                {isAr ? "نسبة العربون من سعر الخدمة" : "Deposit percentage of service price"}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={percent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1 && v <= 100) setPercent(v);
                    }}
                    dir="ltr"
                    style={{
                      width:         84,
                      borderRadius:  10,
                      border:        "1.5px solid var(--color-line)",
                      background:    "var(--color-surface-2)",
                      color:         "var(--color-ink)",
                      fontSize:      18,
                      fontWeight:    800,
                      paddingBlock:  9,
                      paddingInline: 12,
                      paddingInlineEnd: 28,
                      outline:       "none",
                      textAlign:     "center",
                      transition:    "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-jade)";
                      e.currentTarget.style.background  = "var(--color-surface)";
                      e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(10,95,71,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "var(--color-line)";
                      e.currentTarget.style.background  = "var(--color-surface-2)";
                      e.currentTarget.style.boxShadow   = "none";
                    }}
                  />
                  <span
                    style={{
                      position:  "absolute",
                      right:     10,
                      top:       "50%",
                      transform: "translateY(-50%)",
                      fontSize:  13,
                      fontWeight: 600,
                      color:     "var(--color-subtle)",
                    }}
                  >
                    %
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 rounded-[var(--radius-md)] px-3.5 py-2.5"
                  style={{ background: "var(--color-jade-tint)", border: "1px solid var(--color-jade-line)" }}
                >
                  <span style={{ fontSize: 12, color: "var(--color-jade)", fontWeight: 600 }}>
                    {isAr
                      ? `مثال: خدمة 500 ج.م → عربون ${Math.ceil(500 * percent / 100)} ج.م`
                      : `Example: 500 EGP service → deposit ${Math.ceil(500 * percent / 100)} EGP`}
                  </span>
                </div>
              </div>

              {/* Paymob notice */}
              <div
                className="flex items-start gap-2.5 mt-4 rounded-[var(--radius-md)] px-3.5 py-3"
                style={{ background: "var(--color-jade-tint)", border: "1px solid var(--color-jade-line)" }}
              >
                <Info size={13} style={{ color: "var(--color-jade)", marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: "var(--color-jade)", lineHeight: 1.6 }}>
                  {isAr
                    ? "العميل بيدفع العربون أونلاين على صفحة Paymob الآمنة وقت الحجز، وموعد هو اللي مشغّل الدفع ده. لو العملاء مش قادرين يدفعوا، كلّم دعم موعد."
                    : "Customers pay the deposit online on Paymob's secure page when they book; Maw3ed runs the payment setup. If customers can't pay, contact Maw3ed support."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Feedback ────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3.5"
          style={{ background: "var(--color-danger-soft)", border: "1.5px solid var(--color-danger-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "var(--color-danger-soft)" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "var(--color-danger)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-danger)", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {saved && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3.5"
          style={{ background: "var(--color-ok-soft)", border: "1.5px solid var(--color-ok-line)" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "var(--color-ok-soft)" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "var(--color-ok)" }} />
          </div>
          <p style={{ fontSize: 13, color: "var(--color-ok)", fontWeight: 600 }}>
            {isAr ? "تم حفظ الإعدادات بنجاح" : "Settings saved successfully"}
          </p>
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-[var(--radius-lg)] px-5 py-4"
        style={{
          background:   "var(--color-ground)",
          border:       "1.5px solid var(--color-line)",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "var(--color-subtle)" }}>
          {isAr ? "التغييرات تُطبَّق على الحجوزات الجديدة فور الحفظ" : "Changes apply to new bookings immediately after saving"}
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-[var(--radius-md)] font-extrabold text-white transition-all duration-150 disabled:opacity-60 transition-shadow duration-200 hover:shadow-[var(--shadow-raised)] text-[0.8125rem]"
          style={{
            padding:       "10px 22px",
            background:    "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-hover) 60%, var(--color-jade) 100%)",
            boxShadow:     "0 3px 12px rgba(10,95,71,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em" }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {isAr ? "جارٍ الحفظ…" : "Saving…"}
            </>
          ) : (
            <>
              <Check size={14} />
              {isAr ? "حفظ الإعدادات" : "Save Settings"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
