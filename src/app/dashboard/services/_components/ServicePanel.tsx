"use client";

import { useState } from "react";
import { Clock, DollarSign, FileText, Languages, CheckCircle2 } from "lucide-react";
import type { Service } from "./ServicesClient";
import { useLanguage } from "@/contexts/LanguageContext";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

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
  // No default length: a preset 30 was kept by almost every owner, so
  // every service on the site read "30 min" whatever it really took.
  duration:      0,
  price:         0,
  isAvailable:   true,
};

// ─── Shared focus/blur handlers ───────────────────────────────────────────────
const focusStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "var(--color-jade)";
  e.currentTarget.style.background  = "var(--color-surface)";
  e.currentTarget.style.boxShadow   = "0 0 0 3px rgba(10,95,71,0.1)";
};
const blurStyle = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.currentTarget.style.borderColor = "var(--color-line)";
  e.currentTarget.style.background  = "var(--color-surface-2)";
  e.currentTarget.style.boxShadow   = "none";
};

// ─── Base input style ─────────────────────────────────────────────────────────
const fieldBase: React.CSSProperties = {
  width:         "100%",
  borderRadius:  9,
  border:        "1.5px solid var(--color-line)",
  background:    "var(--color-surface-2)",
  color:         "var(--color-ink)",
  fontSize:      14,
  paddingBlock:  10,
  paddingInline: 12,
  outline:       "none",
  transition:    "border-color 0.15s, box-shadow 0.15s, background 0.15s",
  lineHeight:    1.5,
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
    <div style={{ marginBottom: 6 }}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-xs"
        style={{ fontWeight: 600, color: "var(--color-ink-2)" }}
      >
        {children}
        {required && (
          <span style={{ color: "var(--color-danger)", fontSize: 11, lineHeight: 1 }}>*</span>
        )}
      </label>
      {hint && (
        <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 2 }}>{hint}</p>
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
      className="rounded-[var(--radius-md)] overflow-hidden"
      style={{ border: "1.5px solid var(--color-line)" }}
    >
      {/* Section header — compact */}
      <div
        className="flex items-center gap-2.5 px-4 py-2.5"
        style={{ background: "var(--color-ground)", borderBottom: "1px solid var(--color-surface-3)" }}
      >
        <div
          className="w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0"
          style={{ background: "var(--color-jade-tint)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-extrabold rounded-full px-1.5 py-0.5"
              style={{ background: "var(--color-jade)", color: "var(--color-surface)" }}
            >
              {step}
            </span>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--color-ink)" }}>{title}</h3>
          </div>
          <p style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 1 }}>{subtitle}</p>
        </div>
      </div>
      {/* Section body — tighter */}
      <div className="px-4 py-3.5 bg-white" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ServicePanel({ open, onClose, editing, onSave }: Props) {
  const [form,   setForm]   = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const { lang } = useLanguage();
  const isAr = lang === "ar";

  // Opening the panel, or opening it on another service, starts from
  // that service's values (or blank ones).
  const [shownFor, setShownFor] = useState<{ open: boolean; editing: Props["editing"] }>({
    open: false,
    editing: null,
  });
  if (shownFor.open !== open || shownFor.editing !== editing) {
    setShownFor({ open, editing });
    if (open) {
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
    }
  }

  function set<K extends keyof typeof DEFAULT>(k: K, v: (typeof DEFAULT)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.nameAr.trim()) {
      setError(isAr ? "أدخل اسم الخدمة بالعربية — هذا الحقل مطلوب" : "Enter the service name in Arabic — this field is required");
      return;
    }
    if (form.duration < 5) {
      setError(isAr ? "اختار مدة الخدمة — الوقت اللي بتاخده فعلًا" : "Choose how long the service really takes");
      return;
    }
    if (form.price < 0) {
      setError(isAr ? "السعر لا يمكن أن يكون سالبًا" : "Price cannot be negative");
      return;
    }

    setSaving(true);
    try {
      const url    = editing ? `/api/business/services/${editing.id}` : "/api/business/services";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          nameAr:        form.nameAr.trim(),
          // null, not undefined — an undefined key is dropped by
          // JSON.stringify and the old value survives the save.
          nameEn:        form.nameEn.trim()        || null,
          descriptionAr: form.descriptionAr.trim() || null,
          duration:      form.duration,
          price:         form.price,
          isAvailable:   form.isAvailable,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isAr ? "حدث خطأ غير متوقع — حاول مجدداً" : "An unexpected error occurred — please try again"));
        return;
      }
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
      setError(isAr ? "حدث خطأ في الاتصال — تحقق من الإنترنت وحاول مجدداً" : "Connection error — check your internet and try again");
    } finally {
      setSaving(false);
    }
  }

  const title = editing
    ? (isAr ? "تعديل الخدمة" : "Edit Service")
    : (isAr ? "إضافة خدمة جديدة" : "Add New Service");

  const description = editing
    ? (isAr ? "عدّل البيانات ثم احفظ التغييرات" : "Update the details and save")
    : (isAr ? "أدخل تفاصيل الخدمة التي سيحجزها العملاء" : "Enter the service details customers will book");

  return (
    <Modal
      open={open}
      onClose={onClose}
      variant="sheet"
      title={title}
      description={description}
      footer={
        <div className="flex flex-col gap-2.5">
          <p className="m-0 text-center text-[0.6875rem] text-[var(--color-subtle)]">
            {editing
              ? (isAr ? "سيتم تحديث الخدمة فوراً على صفحة حجزك" : "Service will be updated immediately on your booking page")
              : (isAr ? "بعد الإضافة يمكنك تعديل أي بيانات في أي وقت" : "After adding, you can edit any details at any time")}
          </p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="submit"
              form="service-form"
              variant="primary"
              isLoading={saving}
              className="flex-[2]"
            >
              {editing
                ? (isAr ? "حفظ التعديلات" : "Save Changes")
                : (isAr ? "إضافة الخدمة" : "Add Service")}
            </Button>
          </div>
        </div>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">

          {/* ── Section 1: Service info ── */}
          <FormSection
            step={1}
            title={isAr ? "معلومات الخدمة" : "Service Info"}
            subtitle={isAr ? "اسم الخدمة ووصف يساعد العميل على اختيارها" : "Service name and description to help customers choose"}
            icon={<FileText size={13} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          >
            {/* Arabic name */}
            <div>
              <FieldLabel
                htmlFor="nameAr"
                required
                hint={isAr ? "يظهر هذا الاسم للعملاء أثناء الحجز" : "This name is shown to customers during booking"}
              >
                {isAr ? "اسم الخدمة بالعربية" : "Service Name (Arabic)"}
              </FieldLabel>
              <input
                id="nameAr"
                type="text"
                value={form.nameAr}
                onChange={(e) => set("nameAr", e.target.value)}
                placeholder={isAr ? "مثال: كشف عام، قص شعر، تنظيف بشرة..." : "e.g. General Checkup, Haircut, Facial..."}
                style={fieldBase}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>

            {/* English name */}
            <div>
              <FieldLabel htmlFor="nameEn">
                <span className="flex items-center gap-1.5">
                  {isAr ? "اسم الخدمة بالإنجليزية" : "Service Name (English)"}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-xs)]"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-subtle)" }}
                  >
                    {isAr ? "اختياري" : "Optional"}
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
              <FieldLabel htmlFor="descriptionAr">
                <span className="flex items-center gap-1.5">
                  <Languages size={11} style={{ color: "var(--color-subtle)" }} />
                  {isAr ? "وصف الخدمة" : "Service Description"}
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[var(--radius-xs)]"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-subtle)" }}
                  >
                    {isAr ? "اختياري" : "Optional"}
                  </span>
                </span>
              </FieldLabel>
              <textarea
                id="descriptionAr"
                value={form.descriptionAr}
                onChange={(e) => set("descriptionAr", e.target.value)}
                placeholder={isAr ? "وصف مختصر يشرح ما يحصل عليه العميل..." : "A brief description of what the customer gets..."}
                rows={3}
                style={{ ...fieldBase, resize: "none", lineHeight: 1.7 }}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
            </div>
          </FormSection>

          {/* ── Section 2: Price & Duration ── */}
          <FormSection
            step={2}
            title={isAr ? "السعر والمدة" : "Price & Duration"}
            subtitle={isAr ? "حدد سعر الخدمة والوقت المطلوب لتقديمها" : "Set the service price and the time required"}
            icon={<DollarSign size={13} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div>
                <FieldLabel htmlFor="duration" required>
                  <span className="flex items-center gap-1.5">
                    <Clock size={11} style={{ color: "var(--color-jade)" }} />
                    {isAr ? "مدة الخدمة" : "Duration"}
                  </span>
                </FieldLabel>
                <select
                  id="duration"
                  value={form.duration}
                  onChange={(e) => set("duration", Number(e.target.value))}
                  style={{ ...fieldBase, paddingInlineEnd: 8 }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                >
                  <option value={0} disabled>{isAr ? "اختار المدة" : "Choose"}</option>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>{d} {isAr ? "دقيقة" : "min"}</option>
                  ))}
                </select>
                <p style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 3 }}>
                  {isAr ? "لحجز الوقت تلقائياً" : "For automatic time blocking"}
                </p>
              </div>

              {/* Price */}
              <div>
                <FieldLabel htmlFor="price" required>
                  <span className="flex items-center gap-1.5">
                    <DollarSign size={11} style={{ color: "var(--color-warn)" }} />
                    {isAr ? "السعر" : "Price"}
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
                    style={{ ...fieldBase, paddingInlineEnd: 40 }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none text-[0.6875rem]"
                    style={{ insetInlineStart: 10, color: "var(--color-subtle)" }}
                  >
                    {isAr ? "ج.م" : "EGP"}
                  </span>
                </div>
                <p style={{ fontSize: 10, color: "var(--color-subtle)", marginTop: 3 }}>
                  {isAr ? "اترك 0 للمجانية" : "Leave 0 for free"}
                </p>
              </div>
            </div>

            {/* Price/duration preview chip */}
            {form.price > 0 && form.duration > 0 && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{ background: "var(--color-jade-tint)", border: "1px solid var(--color-jade-line)" }}
              >
                <CheckCircle2 size={12} style={{ color: "var(--color-jade)" }} />
                <span style={{ color: "var(--color-jade)", fontWeight: 600, fontSize: 12 }}>
                  {isAr
                    ? `معاينة: ${form.price.toLocaleString("ar-EG-u-nu-latn")} ج.م · ${form.duration} دقيقة`
                    : `Preview: ${form.price.toLocaleString("en-US")} EGP · ${form.duration} min`}
                </span>
              </div>
            )}
          </FormSection>

          {/* ── Section 3: Status ── */}
          <FormSection
            step={3}
            title={isAr ? "حالة الخدمة" : "Service Status"}
            subtitle={isAr ? "تحكم في ظهور الخدمة للعملاء" : "Control whether the service is visible to customers"}
            icon={<CheckCircle2 size={13} strokeWidth={1.75} style={{ color: "var(--color-jade)" }} />}
          >
            <div
              className="flex items-center justify-between rounded-[var(--radius-md)] px-3.5 py-3 cursor-pointer"
              style={{
                background: form.isAvailable ? "var(--color-ok-soft)" : "var(--color-surface-2)",
                border:     `1.5px solid ${form.isAvailable ? "var(--color-ok-line)" : "var(--color-line)"}`,
                transition: "background 0.2s, border-color 0.2s",
              }}
              onClick={() => set("isAvailable", !form.isAvailable)}
            >
              <div className="flex-1 min-w-0">
                <p
                  className="font-bold text-[0.8125rem]"
                  style={{ color: form.isAvailable ? "var(--color-ok)" : "var(--color-muted)" }}
                >
                  {form.isAvailable
                    ? (isAr ? "متاحة للحجز" : "Available for booking")
                    : (isAr ? "غير متاحة" : "Not available")}
                </p>
                <p style={{ fontSize: 11, color: "var(--color-subtle)", marginTop: 1 }}>
                  {form.isAvailable
                    ? (isAr ? "ظاهرة للعملاء ويمكن حجزها الآن" : "Visible to customers and can be booked now")
                    : (isAr ? "معطّلة مؤقتاً دون حذف" : "Temporarily disabled without deleting")}
                </p>
              </div>

              {/* Toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={form.isAvailable}
                onClick={(e) => { e.stopPropagation(); set("isAvailable", !form.isAvailable); }}
                style={{
                  width:             44,
                  height:            24,
                  borderRadius:      12,
                  background:        form.isAvailable ? "var(--color-ok)" : "var(--color-line-2)",
                  position:          "relative",
                  flexShrink:        0,
                  transition:        "background 0.2s",
                  border:            "none",
                  cursor:            "pointer",
                  marginInlineStart: 14,
                }}
              >
                <div
                  style={{
                    position:         "absolute",
                    width:            18,
                    height:           18,
                    borderRadius:     "50%",
                    background:       "var(--color-surface)",
                    boxShadow:        "0 2px 6px rgba(17,32,28,0.2)",
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
          {error && <Alert tone="danger">{error}</Alert>}

      </form>
    </Modal>
  );
}
