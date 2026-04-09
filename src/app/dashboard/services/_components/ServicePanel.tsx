"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Clock, DollarSign, Type, AlignLeft } from "lucide-react";
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

// Shared input style
const inputStyle: React.CSSProperties = {
  width:        "100%",
  borderRadius: 12,
  border:       "1px solid #E2E8F0",
  background:   "#F8FAFC",
  color:        "#0F172A",
  fontSize:     14,
  paddingBlock:  10,
  paddingInline: 14,
  outline:      "none",
  transition:   "border-color 0.15s, box-shadow 0.15s",
};

function PanelInput({
  value,
  onChange,
  placeholder,
  dir,
  type = "text",
  min,
  step,
}: {
  value:       string | number;
  onChange:    (v: string) => void;
  placeholder?: string;
  dir?:        string;
  type?:       string;
  min?:        number;
  step?:       number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      min={min}
      step={step}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "#3B82F6";
        e.currentTarget.style.background  = "#FFFFFF";
        e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "#E2E8F0";
        e.currentTarget.style.background  = "#F8FAFC";
        e.currentTarget.style.boxShadow   = "none";
      }}
    />
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label
      className="block mb-1.5"
      style={{ fontSize: 12, fontWeight: 600, color: "#475569", letterSpacing: "0.01em" }}
    >
      {children}
      {required && <span style={{ color: "#EF4444", marginInlineStart: 4 }}>*</span>}
    </label>
  );
}

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
    if (!form.nameAr.trim()) { setError("أدخل اسم الخدمة بالعربية"); return; }
    if (form.duration < 5)   { setError("المدة يجب أن تكون 5 دقائق على الأقل"); return; }
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
      if (!res.ok) { setError(data.error || "حدث خطأ"); return; }
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
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white flex flex-col"
        style={{ boxShadow: "-8px 0 40px rgba(15,23,42,0.12)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 shrink-0"
          style={{ borderBottom: "1px solid #F1F5F9" }}
        >
          <div>
            <h2
              className="font-black text-[#0F172A]"
              style={{ fontSize: 16, letterSpacing: "-0.01em" }}
            >
              {editing ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {editing ? "عدّل بيانات الخدمة ثم احفظ التغييرات" : "أدخل بيانات الخدمة الجديدة"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", color: "#475569" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <form
          id="service-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Arabic name */}
          <div>
            <FieldLabel required>
              <span className="flex items-center gap-1.5">
                <Type size={11} style={{ color: "#3B82F6" }} />
                اسم الخدمة (عربي)
              </span>
            </FieldLabel>
            <PanelInput
              value={form.nameAr}
              onChange={(v) => set("nameAr", v)}
              placeholder="مثال: قص الشعر، كشف عام، تنظيف بشرة..."
            />
          </div>

          {/* English name */}
          <div>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <Type size={11} style={{ color: "#94A3B8" }} />
                اسم الخدمة (إنجليزي) — اختياري
              </span>
            </FieldLabel>
            <PanelInput
              value={form.nameEn}
              onChange={(v) => set("nameEn", v)}
              placeholder="e.g. Haircut, General Checkup..."
              dir="ltr"
            />
          </div>

          {/* Description */}
          <div>
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <AlignLeft size={11} style={{ color: "#94A3B8" }} />
                وصف الخدمة — اختياري
              </span>
            </FieldLabel>
            <textarea
              value={form.descriptionAr}
              onChange={(e) => set("descriptionAr", e.target.value)}
              placeholder="وصف مختصر يساعد العميل على فهم ما تشمله الخدمة..."
              rows={3}
              style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#3B82F6";
                e.currentTarget.style.background  = "#FFFFFF";
                e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E2E8F0";
                e.currentTarget.style.background  = "#F8FAFC";
                e.currentTarget.style.boxShadow   = "none";
              }}
            />
          </div>

          {/* Duration + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>
                <span className="flex items-center gap-1.5">
                  <Clock size={11} style={{ color: "#7C3AED" }} />
                  المدة
                </span>
              </FieldLabel>
              <select
                value={form.duration}
                onChange={(e) => set("duration", Number(e.target.value))}
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3B82F6";
                  e.currentTarget.style.background  = "#FFFFFF";
                  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.background  = "#F8FAFC";
                  e.currentTarget.style.boxShadow   = "none";
                }}
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} دقيقة</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel required>
                <span className="flex items-center gap-1.5">
                  <DollarSign size={11} style={{ color: "#B45309" }} />
                  السعر
                </span>
              </FieldLabel>
              <input
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(e) => set("price", Number(e.target.value))}
                dir="ltr"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3B82F6";
                  e.currentTarget.style.background  = "#FFFFFF";
                  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(59,130,246,0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E2E8F0";
                  e.currentTarget.style.background  = "#F8FAFC";
                  e.currentTarget.style.boxShadow   = "none";
                }}
              />
            </div>
          </div>

          {/* Availability toggle */}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-4"
            style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
          >
            <div>
              <p className="text-sm font-bold text-[#0F172A]">تفعيل الخدمة</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {form.isAvailable ? "تظهر للعملاء عند الحجز" : "مخفية — لا يراها العملاء"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.isAvailable}
              onClick={() => set("isAvailable", !form.isAvailable)}
              style={{
                width:        44,
                height:       24,
                borderRadius: 12,
                background:   form.isAvailable ? "#1D4ED8" : "#E2E8F0",
                position:     "relative",
                flexShrink:   0,
                transition:   "background 0.2s",
                border:       "none",
                cursor:       "pointer",
              }}
            >
              <div
                style={{
                  position:         "absolute",
                  width:            18,
                  height:           18,
                  borderRadius:     "50%",
                  background:       "#FFFFFF",
                  boxShadow:        "0 1px 4px rgba(15,23,42,0.15)",
                  top:              3,
                  insetInlineStart: form.isAvailable ? "unset" : 3,
                  insetInlineEnd:   form.isAvailable ? 3 : "unset",
                  transition:       "inset 0.2s",
                }}
              />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              className="text-sm rounded-xl px-4 py-3"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}
            >
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div
          className="px-6 py-4 flex gap-3 shrink-0"
          style={{ borderTop: "1px solid #F1F5F9" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
            style={{
              background:  "#F8FAFC",
              border:      "1px solid #E2E8F0",
              color:       "#475569",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background  = "#F1F5F9";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background  = "#F8FAFC";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0";
            }}
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="service-form"
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              boxShadow:  "0 4px 14px rgba(59,130,246,0.25)",
              border:     "none",
            }}
            onMouseEnter={(e) => {
              if (!saving) (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "";
            }}
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {editing ? "حفظ التعديلات" : "إضافة الخدمة"}
          </button>
        </div>
      </div>
    </>
  );
}
