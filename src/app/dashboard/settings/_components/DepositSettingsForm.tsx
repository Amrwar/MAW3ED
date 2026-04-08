"use client";

import { useState } from "react";
import { Loader2, CreditCard, Info } from "lucide-react";

interface DepositSettingsFormProps {
  initialEnabled: boolean;
  initialPercent: number;
}

export default function DepositSettingsForm({
  initialEnabled,
  initialPercent,
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

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)]/10 flex items-center justify-center">
          <CreditCard size={18} className="text-[var(--color-brand)]" />
        </div>
        <div>
          <h2 className="font-bold text-[var(--color-text-primary)]">إعدادات العربون</h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            اطلب من العملاء دفع عربون لتأكيد الحجز
          </p>
        </div>
      </div>

      {/* Enable/Disable toggle */}
      <div className="flex items-center justify-between p-4 bg-[var(--color-surface-2)] rounded-xl">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            تفعيل العربون
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            عند التفعيل، لن يُؤكَّد الحجز إلا بعد دفع العربون
          </p>
        </div>
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enabled ? "bg-[var(--color-brand)]" : "bg-[var(--color-border)]"
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Percentage input — only shown when enabled */}
      {enabled && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)]">
            نسبة العربون من سعر الخدمة
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              value={percent}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 100) setPercent(v);
              }}
              className="input w-24 text-center text-lg font-bold"
              dir="ltr"
            />
            <span className="text-sm text-[var(--color-text-muted)]">%</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              (مثال: خدمة بسعر 500 جنيه → عربون {Math.ceil(500 * percent / 100)} جنيه)
            </span>
          </div>

          <div className="flex items-start gap-2 mt-3 bg-blue-50 rounded-xl p-3">
            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              تأكد من إعداد حساب Paymob وإضافة متغيرات البيئة قبل تفعيل هذا الخيار.
              راجع وثائق الإعداد للتفاصيل.
            </p>
          </div>
        </div>
      )}

      {/* Error / Success feedback */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
          تم حفظ الإعدادات بنجاح
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn btn-primary gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
        حفظ الإعدادات
      </button>
    </div>
  );
}
