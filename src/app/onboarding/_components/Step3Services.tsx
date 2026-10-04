"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import type { OnboardingData, ServiceItem } from "./OnboardingForm";

const DURATION_OPTIONS = [
  { value: 15,  label: "15 دقيقة" },
  { value: 30,  label: "30 دقيقة" },
  { value: 45,  label: "45 دقيقة" },
  { value: 60,  label: "ساعة" },
  { value: 90,  label: "ساعة ونص" },
  { value: 120, label: "ساعتان" },
  { value: 180, label: "3 ساعات" },
];

const EMPTY_SERVICE: ServiceItem = { nameAr: "", duration: 30, price: 0 };

interface Props {
  data:   OnboardingData;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}

export default function Step3Services({ data, onNext, onBack }: Props) {
  const [services, setServices] = useState<ServiceItem[]>(
    data.services.length > 0 ? data.services : [{ ...EMPTY_SERVICE }]
  );
  const [error, setError] = useState<string | null>(null);

  function addService() {
    if (services.length >= 10) return;
    setServices((prev) => [...prev, { ...EMPTY_SERVICE }]);
  }

  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateService(i: number, field: keyof ServiceItem, value: string | number) {
    setServices((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  }

  function handleNext() {
    setError(null);
    const valid = services.every(
      (s) => s.nameAr.trim().length >= 2 && s.duration > 0 && s.price >= 0
    );
    if (!valid || services.length === 0) {
      setError("أضف خدمة واحدة على الأقل وتأكد من اكتمال البيانات");
      return;
    }
    onNext({ services });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
          خدماتك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          أضف الخدمات التي تقدمها للعملاء. يمكنك إضافة المزيد لاحقًا.
        </p>
      </div>

      {/* Service list */}
      <div className="space-y-3">
        {services.map((service, i) => (
          <div
            key={i}
            className="border border-[var(--color-border)] rounded-xl p-4 space-y-3 bg-[var(--color-surface-2)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                خدمة #{i + 1}
              </span>
              {services.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeService(i)}
                  className="text-[var(--color-danger)] hover:text-[var(--color-danger)] transition-colors p-1"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Service name */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                اسم الخدمة <span className="text-[var(--color-danger)]">*</span>
              </label>
              <input
                type="text"
                placeholder="مثال: كشف باطنة، قص وتشكيل"
                value={service.nameAr}
                onChange={(e) => updateService(i, "nameAr", e.target.value)}
                className="input text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  المدة
                </label>
                <select
                  value={service.duration}
                  onChange={(e) => updateService(i, "duration", Number(e.target.value))}
                  className="input text-sm"
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  السعر (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50"
                  placeholder="250"
                  value={service.price || ""}
                  onChange={(e) => updateService(i, "price", Number(e.target.value))}
                  className="input text-sm"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add service button */}
      {services.length < 10 && (
        <button
          type="button"
          onClick={addService}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-muted)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-colors"
        >
          <Plus size={16} />
          إضافة خدمة أخرى
        </button>
      )}

      {error && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-xl px-4 py-3">
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
