"use client";

import { useState } from "react";
import { Loader2, CreditCard, Info, Lock, Check, X } from "lucide-react";
import Link from "next/link";

interface DepositSettingsFormProps {
  initialEnabled:  boolean;
  initialPercent:  number;
  canUseDeposits?: boolean;
}

const card: React.CSSProperties = {
  background:   "#FFFFFF",
  border:       "1.5px solid #E2E8F0",
  borderRadius: 20,
  boxShadow:    "0 1px 6px rgba(15,23,42,0.05)",
  overflow:     "hidden",
};

const cardHead: React.CSSProperties = {
  display:       "flex",
  alignItems:    "center",
  gap:           12,
  padding:       "14px 22px",
  background:    "#FAFBFD",
  borderBottom:  "1px solid #F1F5F9",
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
        setError(data.error ?? "حدث خطأ أثناء الحفظ");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("تعذّر الاتصال بالخادم");
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
              background: "#FFFBEB", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Lock size={14} style={{ color: "#D97706" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>إعدادات العربون</p>
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
              متاح في خطة الاحترافي فقط
            </p>
          </div>
        </div>
        <div style={{ padding: "40px 24px", textAlign: "center" }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A" }}
          >
            <Lock size={26} style={{ color: "#D97706" }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
            ميزة حجب العربون
          </h2>
          <p
            style={{
              fontSize: 13, color: "#64748B", lineHeight: 1.7,
              maxWidth: 340, margin: "0 auto 24px",
            }}
          >
            إعدادات العربون متاحة فقط في خطة{" "}
            <strong style={{ color: "#D97706" }}>الاحترافي (PRO)</strong>.
            يمكنك الترقية الآن للبدء في استقبال مدفوعات مسبقة من عملائك.
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-xl font-bold text-white transition-colors"
            style={{
              padding:    "10px 24px",
              fontSize:   13,
              background: "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
              boxShadow:  "0 3px 12px rgba(217,119,6,0.3)",
            }}
          >
            عرض الخطط والأسعار
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
              background: "#EFF6FF", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <CreditCard size={14} style={{ color: "#1D4ED8" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>إعدادات العربون</p>
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
              اطلب من العملاء دفع عربون لتأكيد الحجز
            </p>
          </div>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Enable toggle row */}
          <div
            className="flex items-center justify-between rounded-xl px-4 py-4 cursor-pointer transition-all"
            style={{
              background: enabled ? "#F0FDF4" : "#F8FAFC",
              border:     `1.5px solid ${enabled ? "#BBF7D0" : "#E2E8F0"}`,
              transition: "background 0.2s, border-color 0.2s",
            }}
            onClick={() => setEnabled((v) => !v)}
          >
            <div className="flex-1">
              <p
                style={{
                  fontSize:   13,
                  fontWeight: 700,
                  color:      enabled ? "#15803D" : "#475569",
                  marginBottom: 2,
                }}
              >
                {enabled ? "العربون مفعّل" : "العربون معطّل"}
              </p>
              <p style={{ fontSize: 11, color: "#94A3B8" }}>
                {enabled
                  ? "لن يُؤكَّد الحجز إلا بعد دفع العربون"
                  : "عند التفعيل، سيُطلب من العملاء دفع عربون"}
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
                background:   enabled ? "#16A34A" : "#D1D5DB",
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
                  background: "#FFFFFF",
                  boxShadow:  "0 1px 4px rgba(15,23,42,0.2)",
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
                  color:      "#374151",
                  display:    "block",
                  marginBottom: 8,
                }}
              >
                نسبة العربون من سعر الخدمة
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
                      border:        "1.5px solid #E2E8F0",
                      background:    "#F8FAFC",
                      color:         "#0F172A",
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
                      e.currentTarget.style.borderColor = "#1D4ED8";
                      e.currentTarget.style.background  = "#FFFFFF";
                      e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(29,78,216,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#E2E8F0";
                      e.currentTarget.style.background  = "#F8FAFC";
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
                      color:     "#94A3B8",
                    }}
                  >
                    %
                  </span>
                </div>
                <div
                  className="flex items-center gap-2 rounded-xl px-3.5 py-2.5"
                  style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
                >
                  <span style={{ fontSize: 12, color: "#1D4ED8", fontWeight: 600 }}>
                    مثال: خدمة 500 ج.م → عربون {Math.ceil(500 * percent / 100)} ج.م
                  </span>
                </div>
              </div>

              {/* Paymob notice */}
              <div
                className="flex items-start gap-2.5 mt-4 rounded-xl px-3.5 py-3"
                style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
              >
                <Info size={13} style={{ color: "#3B82F6", marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 11, color: "#1D4ED8", lineHeight: 1.6 }}>
                  تأكد من إعداد حساب Paymob وإضافة متغيرات البيئة قبل تفعيل هذا الخيار.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Feedback ────────────────────────────────────────── */}
      {error && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#FEF2F2", border: "1.5px solid #FECACA" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "#FEE2E2" }}
          >
            <X size={10} strokeWidth={2.5} style={{ color: "#EF4444" }} />
          </div>
          <p style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>{error}</p>
        </div>
      )}
      {saved && (
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
          style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0" }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "#DCFCE7" }}
          >
            <Check size={10} strokeWidth={2.5} style={{ color: "#16A34A" }} />
          </div>
          <p style={{ fontSize: 13, color: "#15803D", fontWeight: 600 }}>
            تم حفظ الإعدادات بنجاح
          </p>
        </div>
      )}

      {/* ── Save bar ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{
          background:   "#FAFBFD",
          border:       "1.5px solid #E2E8F0",
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 12, color: "#94A3B8" }}>
          التغييرات تُطبَّق على الحجوزات الجديدة فور الحفظ
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl font-black text-white transition-all duration-150 disabled:opacity-60"
          style={{
            padding:       "10px 22px",
            fontSize:      13,
            background:    "linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)",
            boxShadow:     "0 3px 12px rgba(29,78,216,0.28)",
            border:        "none",
            cursor:        saving ? "not-allowed" : "pointer",
            letterSpacing: "-0.01em",
          }}
          onMouseEnter={(e) => {
            if (!saving) {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.filter    = "brightness(1.08)";
              el.style.boxShadow = "0 5px 18px rgba(29,78,216,0.38)";
              el.style.transform = "translateY(-1px)";
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.filter    = "";
            el.style.boxShadow = "0 3px 12px rgba(29,78,216,0.28)";
            el.style.transform = "";
          }}
        >
          {saving ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              <Check size={14} />
              حفظ الإعدادات
            </>
          )}
        </button>
      </div>
    </div>
  );
}
