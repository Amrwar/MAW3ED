"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import type { OnboardingData, AvailabilityDay } from "./OnboardingForm";

interface Props {
  data:   OnboardingData;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}

export default function Step4Availability({ data, onNext, onBack }: Props) {
  const [availability, setAvailability] = useState<AvailabilityDay[]>(
    data.availability
  );
  const [error, setError] = useState<string | null>(null);

  function toggle(i: number) {
    setAvailability((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, isClosed: !d.isClosed } : d))
    );
  }

  function updateTime(i: number, field: "openTime" | "closeTime", value: string) {
    setAvailability((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d))
    );
  }

  function handleNext() {
    setError(null);
    const anyOpen = availability.some((d) => !d.isClosed);
    if (!anyOpen) {
      setError("يجب أن يكون العمل مفتوحًا في يوم واحد على الأقل");
      return;
    }
    onNext({ availability });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
          أوقات عملك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          حدد أيام وساعات عملك الأسبوعية
        </p>
      </div>

      <div className="space-y-2">
        {availability.map((day, i) => (
          <div
            key={day.dayOfWeek}
            className={cn(
              "flex items-center gap-4 p-3.5 rounded-[var(--radius-md)] border transition-all",
              day.isClosed
                ? "bg-[var(--color-surface-3)] border-[var(--color-border)] opacity-60"
                : "bg-white border-[var(--color-border)]"
            )}
          >
            {/* Day name */}
            <span className="w-16 text-sm font-semibold text-[var(--color-text-primary)] shrink-0">
              {day.dayAr}
            </span>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggle(i)}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors shrink-0",
                day.isClosed
                  ? "bg-[var(--color-border-2)]"
                  : "bg-[var(--color-brand)]"
              )}
              aria-label={day.isClosed ? "مغلق" : "مفتوح"}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200",
                  day.isClosed ? "start-0.5" : "end-0.5"
                )}
              />
            </button>

            {/* Time inputs */}
            {!day.isClosed ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={day.openTime}
                  onChange={(e) => updateTime(i, "openTime", e.target.value)}
                  className="input text-sm py-1.5 px-2 w-28"
                />
                <span className="text-xs text-[var(--color-text-muted)]">—</span>
                <input
                  type="time"
                  value={day.closeTime}
                  onChange={(e) => updateTime(i, "closeTime", e.target.value)}
                  className="input text-sm py-1.5 px-2 w-28"
                />
              </div>
            ) : (
              <span className="text-sm text-[var(--color-text-muted)] flex-1">
                إجازة
              </span>
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-[var(--radius-md)] px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          → رجوع
        </Button>
        <Button type="button" variant="primary" className="flex-1" onClick={handleNext}>
          التالي ←
        </Button>
      </div>
    </div>
  );
}
