"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import type { AvailabilityDay } from "./SettingsClient";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

type Props = { initialAvailability: AvailabilityDay[] };

export default function AvailabilityForm({ initialAvailability }: Props) {
  const [days,    setDays]    = useState<AvailabilityDay[]>(initialAvailability);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState("");

  function toggleDay(i: number) {
    setDays((prev) =>
      prev.map((d) => d.dayOfWeek === i ? { ...d, isClosed: !d.isClosed } : d)
    );
    setSuccess(false);
  }

  function setTime(i: number, field: "openTime" | "closeTime", val: string) {
    setDays((prev) =>
      prev.map((d) => d.dayOfWeek === i ? { ...d, [field]: val } : d)
    );
    setSuccess(false);
  }

  function validate(): string | null {
    for (const d of days) {
      if (d.isClosed) continue;
      if (!d.openTime || !d.closeTime) return `أدخل وقت العمل ليوم ${DAY_NAMES[d.dayOfWeek]}`;

      const [oh, om] = d.openTime.split(":").map(Number);
      const [ch, cm] = d.closeTime.split(":").map(Number);
      const openMin  = oh * 60 + om;
      const closeMin = ch * 60 + cm;

      if (closeMin <= openMin) {
        return `وقت الإغلاق يجب أن يكون بعد وقت الفتح في يوم ${DAY_NAMES[d.dayOfWeek]}`;
      }
      if (closeMin - openMin < 30) {
        return `يجب أن يكون وقت العمل 30 دقيقة على الأقل في يوم ${DAY_NAMES[d.dayOfWeek]}`;
      }
    }
    return null;
  }

  async function handleSave() {
    setError("");
    setSuccess(false);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/business/availability", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ availability: days }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "حدث خطأ أثناء الحفظ"); return; }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("حدث خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  }

  const openCount = days.filter((d) => !d.isClosed).length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="card p-4 flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          <span className="font-bold text-[var(--color-text-primary)]">{openCount}</span>
          {" "}أيام عمل أسبوعيًا ·{" "}
          <span className="font-bold text-[var(--color-text-primary)]">{7 - openCount}</span>
          {" "}أيام إجازة
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          التغييرات تؤثر فورًا على الحجوزات الجديدة
        </p>
      </div>

      {/* Days */}
      <div className="card overflow-hidden p-0 divide-y divide-[var(--color-border)]">
        {days.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center gap-4 px-5 py-4 transition-colors ${
              day.isClosed ? "bg-[var(--color-surface-2)]" : "bg-white"
            }`}
          >
            {/* Toggle */}
            <button
              type="button"
              dir="ltr"
              role="switch"
              aria-checked={!day.isClosed}
              onClick={() => toggleDay(day.dayOfWeek)}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
                !day.isClosed ? "bg-[var(--color-accent)]" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  !day.isClosed ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>

            {/* Day name */}
            <span
              className={`w-20 text-sm font-medium shrink-0 ${
                day.isClosed
                  ? "text-[var(--color-text-muted)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {DAY_NAMES[day.dayOfWeek]}
            </span>

            {/* Times or closed label */}
            {day.isClosed ? (
              <span className="text-sm text-[var(--color-text-muted)]">إجازة</span>
            ) : (
              <div className="flex items-center gap-2 flex-1" dir="ltr">
                <input
                  type="time"
                  value={day.openTime}
                  onChange={(e) => setTime(day.dayOfWeek, "openTime", e.target.value)}
                  className="input py-1.5 text-sm w-32"
                />
                <span className="text-[var(--color-text-muted)] text-sm">–</span>
                <input
                  type="time"
                  value={day.closeTime}
                  onChange={(e) => setTime(day.dayOfWeek, "closeTime", e.target.value)}
                  className="input py-1.5 text-sm w-32"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Feedback */}
      {error && (
        <p className="text-sm text-red-500 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl flex items-center gap-2">
          <Check size={15} />
          تم حفظ أوقات العمل بنجاح
        </p>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary gap-2 min-w-36"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? "جاري الحفظ..." : "حفظ أوقات العمل"}
        </button>
      </div>
    </div>
  );
}
