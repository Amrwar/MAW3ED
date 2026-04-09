"use client";

import { useState, useEffect } from "react";
import {
  X, Loader2, Clock, DollarSign,
  FileText, Languages, CheckCircle2, Sparkles,
} from "lucide-react";
import type { Service } from "./ServicesClient";

const DURATIONS = [10, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

type Props = {
  open:    boolean;
  onClose: () => void;
  editing: Service | null;
  onSave:  (service: Service, isNew: boolean) => void;
};

const DEFAULT = {
  nameAr:        "",
  nameEn:        "",
  descriptionAr: "",
  duration:      30,
  price:         0,
  isAvailable:   true,
};

// ─── Shared focus/blur handlers ───────────────────────────────────────────────
const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "#1D4ED8";
  e.currentTarget.style.background  = "#FFFFFF";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(29,78,216,0.1)";
};
const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "#E2E8F0";
  e.currentTarget.style.background  = "#F8FAFC";
  e.currentTarget.style.boxShadow   = "none";
};

// ─── Base input style ─────────────────────────────────────────────────────────
const fieldBase: React.CSSProperties = {
  width:        "100%",
  borderRadius: 10,
  border:       "1.5px solid #E2E8F0",
  background:   "#F8FAFC",
  color:        "#0F172A",
  fontSize:     14,
  paddingBlock:  12,
  paddingInline: 14,
  outline:      "none",
  transition:   "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  lineHeight:   1.5,
};

// ─── Field label ──────────────────────────────────────────────────────────────
function FieldLabel({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor?:  string;
  children:  React.ReactNode;
  required?: boolean;
  hint?:     string;
}) {
  return (
    <div className="mb-2">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1"
        style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}
      >
        {children}
        {required && (
          <span style={{ color: "#EF4444", fontSize: 12, lineHeight: 1 }}>*</span>
        )}
      </label>
      {hint && (
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{hint}</p>
      )}
    </div>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────
function FormSection({
  step,
  title,
  subtitle,
  icon,
  children,
}: {
  step:     number;
  title:    string;
  subtitle: string;
  icon:     React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1.5px solid #E2E8F0" }}
    >
      {/* Section header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: "#FAFBFD", borderBottom: "1px solid #F1F5F9" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#EFF6FF" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-black rounded-full px-2 py-0.5"
              style={{ background: "#1D4ED8", color: "#FFFFFF" }}
            >
              {step}
            </span>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
          </div>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{subtitle}</p>
        </div>
      </div>
      {/* Section body */}
      <div className="px-5 py-5 space-y-4 bg-white">{children}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ServicePanel({ open, onClose, editing, onSave }: Props) {
  const [form,   setForm]   = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      editing
        ? {
            nameAr:        editing.nameAr,
            nameEn:        editing.nameEn,
            descriptionAr: editing.descriptionAr,
            duration:      editing.duration,
            price:         editing.price,
            isAvailable:   editing.isAvailable,
          }
        : DEFAULT,
    );
  }, [open, editing]);

  function set<K extends keyof typeof DEFAULT>(k: K, v: (typeof DEFAULT)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.nameAr.trim()) { setError("أدخل اسم الخدمة بالعربية — هذا الحقل مطلوب"); return; }
    if (form.duration < 5)   { setError("يجب أن تكون مدة الخدمة 5 دقائق على الأقل"); return; }
    if (form.price < 0)      { setError("السعر لا يمكن أن يكون سالبًا"); return; }

    setSaving(true);
    try {
      const url    = editing ? `/api/business/services/${editing.id}` : "/api/business/services";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nameAr:        form.nameAr.trim(),
          nameEn:        form.nameEn.trim()        || undefined,
          descriptionAr: form.descriptionAr.trim() || undefined,
          duration:      form.duration,
          price:         form.price,
          isAvailable:   form.isAvailable,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ غير متوقع — حاول مجدداً"); return; }
      onSave(
        {
          id:            data.id,
          nameAr:        data.nameAr,
          nameEn:        data.nameEn        ?? "",
          descriptionAr: data.descriptionAr ?? "",
          duration:      data.duration,
          price:         Number(data.price),
          currency:      data.currency,
          isAvailable:   data.isAvailable,
          sortOrder:     data.sortOrder,
        },
        !editing,
      );
    } catch {
      setError("حدث خطأ في الاتصال — تحقق من الإنترنت وحاول مجدداً");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 end-0 z-50 w-full max-w-[460px] bg-white flex flex-col"
        style={{ boxShadow: "-12px 0 48px rgba(15,23,42,0.14)" }}
      >

        {/* ── Panel header ────────────────────────────────────── */}
        <div className="shrink-0" style={{ borderBottom: "1.5px solid #F1F5F9" }}>
          {/* Accent bar */}
          <div
            style={{
              height:     3,
              background: "linear-gradient(90deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)",
            }}
          />
          <div className="flex items-start justify-between px-6 py-5">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)" }}
                >
                  <Sparkles size={14} strokeWidth={2} style={{ color: "#FFFFFF" }} />
                </div>
                <h2
                  className="font-black text-[#0F172A]"
                  style={{ fontSize: 17, letterSpacing: "-0.02em" }}
                >
                  {editing ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
                </h2>
              </div>
              <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5, maxWidth: 280 }}>
                {editing
                  ? "عدّل بيانات الخدمة ثم احفظ التغييرات — ستُحدَّث فوراً للعملاء"
                  : "أدخل تفاصيل الخدمة التي سيتمكن العملاء من حجزها"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 shrink-0 mt-0.5"
              style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", color: "#64748B" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background  = "#F1F5F9";
                el.style.borderColor = "#CBD5E1";
                el.style.color       = "#0F172A";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background  = "#F8FAFC";
                el.style.borderColor = "#E2E8F0";
                el.style.color       = "#64748B";
              }}
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ── Form body ────────────────────────────────────────── */}
        <form
          id="service-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
          style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}
        >

          {/* ── Section 1: Service info ── */}
          <FormSection
            step={1}
            title="معلومات الخدمة"
            subtitle="أضف اسم الخدمة ووصفًا يساعد العميل على فهمها"
            icon={<FileText size={14} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          >
            {/* Arabic name */}
            <div>
              <FieldLabel htmlFor="nameAr" required hint="اسم الخدمة كما سيظهر للعملاء أثناء الحجز">
                اسم الخدمة بالعربية
              </FieldLabel>
              <input
                id="nameAr"
                type="text"
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                placeholder="مثال: كشف عام، قص شعر، تنظيف بشرة..."
                style={fieldBase}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            {/* English name */}
            <div>
              <FieldLabel
                htmlFor="nameEn"
                hint="اختياري — يظهر بجوار الاسم العربي للعملاء الدوليين"
              >
                <span className="flex items-center gap-1.5">
                  اسم الخدمة بالإنجليزية
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: "#F1F5F9", color: "#94A3B8" }}
                  >
                    اختياري
                  </span>
                </span>
              </FieldLabel>
              <input
                id="nameEn"
                type="text"
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                placeholder="e.g. General Checkup, Haircut..."
                dir="ltr"
                style={fieldBase}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            {/* Description */}
            <div>
              <FieldLabel
                htmlFor="descriptionAr"
                hint="وصف واضح يزيد من احتمالية الحجز بنسبة تصل إلى 40%"
              >
                <span className="flex items-center gap-1.5">
                  <Languages size={12} style={{ color: "#94A3B8" }} />
                  وصف الخدمة
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: "#F1F5F9", color: "#94A3B8" }}
                  >
                    اختياري
                  </span>
                </span>
              </FieldLabel>
              <textarea
                id="descriptionAr"
                value={form.descriptionAr}
                onChange={(e) => set("descriptionAr", e.target.value)}
                placeholder="أدخل وصفًا مختصرًا يشرح ما يحصل عليه العميل من هذه الخدمة..."
                rows={4}
                style={{ ...fieldBase, resize: "none", lineHeight: 1.7 }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>
          </FormSection>

          {/* ── Section 2: Price & Duration ── */}
          <FormSection
            step={2}
            title="السعر والمدة"
            subtitle="حدد سعر الخدمة والوقت المطلوب لتقديمها"
            icon={<DollarSign size={14} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          >
            <div className="grid grid-cols-2 gap-4">
              {/* Duration */}
              <div>
                <FieldLabel htmlFor="duration" required>
                  <span className="flex items-center gap-1.5">
                    <Clock size={12} style={{ color: "#7C3AED" }} />
                    مدة الخدمة
                  </span>
                </FieldLabel>
                <div className="relative">
                  <select
                    id="duration"
                    value={form.duration}
                    onChange={(e) => set("duration", Number(e.target.value))}
                    style={{ ...fieldBase, paddingInlineEnd: 10 }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d} value={d}>{d} دقيقة</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                  يُستخدم لحجز الوقت تلقائياً
                </p>
              </div>

              {/* Price */}
              <div>
                <FieldLabel htmlFor="price" required>
                  <span className="flex items-center gap-1.5">
                    <DollarSign size={12} style={{ color: "#B45309" }} />
                    السعر
                  </span>
                </FieldLabel>
                <div className="relative">
                  <input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={form.price}
                    onChange={(e) => set("price", Number(e.target.value))}
                    dir="ltr"
                    style={{ ...fieldBase, paddingInlineEnd: 42 }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
                    style={{ insetInlineStart: 12, color: "#94A3B8" }}
                  >
                    ج.م
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>
                  اترك 0 للخدمات المجانية
                </p>
              </div>
            </div>

            {/* Price/duration preview chip */}
            {form.price > 0 && form.duration > 0 && (
              <div
                className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs"
                style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}
              >
                <CheckCircle2 size={13} style={{ color: "#3B82F6" }} />
                <span style={{ color: "#1D4ED8", fontWeight: 600 }}>
                  معاينة: {form.price.toLocaleString("ar-EG")} ج.م · {form.duration} دقيقة
                </span>
              </div>
            )}
          </FormSection>

          {/* ── Section 3: Status ── */}
          <FormSection
            step={3}
            title="حالة الخدمة"
            subtitle="تحكم في ظهور الخدمة للعملاء أثناء الحجز"
            icon={<CheckCircle2 size={14} strokeWidth={1.75} style={{ color: "#1D4ED8" }} />}
          >
            <div
              className="flex items-center justify-between rounded-xl px-4 py-4 cursor-pointer"
              style={{
                background:  form.isAvailable ? "#F0FDF4" : "#F8FAFC",
                border:      `1.5px solid ${form.isAvailable ? "#BBF7D0" : "#E2E8F0"}`,
                transition:  "background 0.2s, border-color 0.2s",
              }}
              onClick={() => set("isAvailable", !form.isAvailable)}
            >
              <div className="flex-1">
                <p
                  className="font-bold"
                  style={{
                    fontSize: 14,
                    color:    form.isAvailable ? "#15803D" : "#475569",
                  }}
                >
                  {form.isAvailable ? "متاحة للحجز" : "غير متاحة"}
                </p>
                <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                  {form.isAvailable
                    ? "الخدمة ظاهرة للعملاء ويمكن حجزها الآن"
                    : "يمكنك تعطيل الخدمة مؤقتًا دون حذفها"}
                </p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={form.isAvailable}
                onClick={(e) => { e.stopPropagation(); set("isAvailable", !form.isAvailable); }}
                style={{
                  width:        48,
                  height:       26,
                  borderRadius: 13,
                  background:   form.isAvailable ? "#16A34A" : "#D1D5DB",
                  position:     "relative",
                  flexShrink:   0,
                  transition:   "background 0.2s",
                  border:       "none",
                  cursor:       "pointer",
                  marginInlineStart: 16,
                }}
              >
                <div
                  style={{
                    position:         "absolute",
                    width:            20,
                    height:           20,
                    borderRadius:     "50%",
                    background:       "#FFFFFF",
                    boxShadow:        "0 2px 6px rgba(15,23,42,0.2)",
                    top:              3,
                    insetInlineStart: form.isAvailable ? "unset" : 3,
                    insetInlineEnd:   form.isAvailable ? 3 : "unset",
                    transition:       "inset 0.2s",
                  }}
                />
              </button>
            </div>
          </FormSection>

          {/* ── Error message ── */}
          {error && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3.5"
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

          {/* Spacer for footer overlap */}
          <div style={{ height: 4 }} />
        </form>

        {/* ── Sticky footer ───────────────────────────────────── */}
        <div
          className="shrink-0 px-6 py-4"
          style={{
            borderTop:  "1.5px solid #F1F5F9",
            background: "#FFFFFF",
          }}
        >
          {/* Helper text */}
          <p style={{ fontSize: 11, color: "#94A3B8", marginBottom: 12, textAlign: "center" }}>
            {editing
              ? "سيتم تحديث الخدمة فوراً على صفحة حجزك"
              : "بعد الإضافة يمكنك تعديل أي بيانات في أي وقت"}
          </p>

          <div className="flex gap-3">
            {/* Cancel */}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl font-semibold transition-all duration-150"
              style={{
                paddingBlock: 12,
                fontSize:     14,
                background:   "#F8FAFC",
                border:       "1.5px solid #E2E8F0",
                color:        "#475569",
                cursor:       "pointer",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background  = "#F1F5F9";
                el.style.borderColor = "#CBD5E1";
                el.style.color       = "#0F172A";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background  = "#F8FAFC";
                el.style.borderColor = "#E2E8F0";
                el.style.color       = "#475569";
              }}
            >
              إلغاء
            </button>

            {/* Submit */}
            <button
              type="submit"
              form="service-form"
              disabled={saving}
              className="flex items-center justify-center gap-2.5 rounded-xl font-black text-white transition-all duration-200 disabled:opacity-60"
              style={{
                flex:         2,
                paddingBlock: 12,
                fontSize:     14,
                background:   "linear-gradient(135deg, #1D4ED8 0%, #2563EB 60%, #3B82F6 100%)",
                boxShadow:    "0 4px 16px rgba(29,78,216,0.3)",
                border:       "none",
                cursor:       saving ? "not-allowed" : "pointer",
                letterSpacing: "-0.01em",
              }}
              onMouseEnter={(e) => {
                if (!saving) {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.filter    = "brightness(1.08)";
                  el.style.boxShadow = "0 6px 22px rgba(29,78,216,0.4)";
                  el.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.filter    = "";
                el.style.boxShadow = "0 4px 16px rgba(29,78,216,0.3)";
                el.style.transform = "";
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  {editing ? "حفظ التعديلات" : "إضافة الخدمة"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
