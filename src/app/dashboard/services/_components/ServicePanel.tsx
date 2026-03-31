"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
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

export default function ServicePanel({ open, onClose, editing, onSave }: Props) {
  const [form, setForm] = useState(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

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
        : DEFAULT
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

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        !editing
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
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 end-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--color-border)] shrink-0">
          <h2 className="font-bold text-[var(--color-text-primary)]">
            {editing ? "تعديل الخدمة" : "إضافة خدمة جديدة"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form
          id="service-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5"
        >
          {/* Arabic name */}
          <div>
            <label className="form-label">
              اسم الخدمة (عربي) <span className="text-red-500">*</span>
            </label>
            <input
              value={form.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              placeholder="مثال: قص الشعر"
              className="input w-full mt-1.5"
            />
          </div>

          {/* English name */}
          <div>
            <label className="form-label">اسم الخدمة (إنجليزي) — اختياري</label>
            <input
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
              placeholder="e.g. Haircut"
              dir="ltr"
              className="input w-full mt-1.5"
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">وصف الخدمة — اختياري</label>
            <textarea
              value={form.descriptionAr}
              onChange={(e) => set("descriptionAr", e.target.value)}
              placeholder="وصف مختصر يساعد العميل على فهم الخدمة..."
              rows={3}
              className="input w-full mt-1.5 resize-none"
            />
          </div>

          {/* Duration + Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                المدة <span className="text-red-500">*</span>
              </label>
              <select
                value={form.duration}
                onChange={(e) => set("duration", Number(e.target.value))}
                className="input w-full mt-1.5"
              >
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} دقيقة
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">
                السعر (ج.م) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={form.price}
                onChange={(e) => set("price", Number(e.target.value))}
                className="input w-full mt-1.5"
                dir="ltr"
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-xl">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">تفعيل الخدمة</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                تظهر للعملاء عند الحجز
              </p>
            </div>
            <button
              type="button"
              dir="ltr"
              role="switch"
              aria-checked={form.isAvailable}
              onClick={() => set("isAvailable", !form.isAvailable)}
              className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none ${
                form.isAvailable ? "bg-[var(--color-accent)]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.isAvailable ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-3 shrink-0">
          <button type="button" onClick={onClose} className="btn btn-outline flex-1">
            إلغاء
          </button>
          <button
            type="submit"
            form="service-form"
            disabled={saving}
            className="btn btn-primary flex-1 gap-2"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {editing ? "حفظ التعديلات" : "إضافة الخدمة"}
          </button>
        </div>
      </div>
    </>
  );
}
