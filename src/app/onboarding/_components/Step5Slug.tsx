"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { makeSlug } from "@/lib/api";
import type { OnboardingData } from "./OnboardingForm";

interface Props {
  data:   OnboardingData;
  onNext: (d: Partial<OnboardingData>) => void;
  onBack: () => void;
}

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

export default function Step5Slug({ data, onNext, onBack }: Props) {
  const suggested = makeSlug(data.nameEn || "") || `business-${Math.random().toString(36).slice(2, 7)}`;

  const [slug, setSlug]     = useState(data.slug || suggested);
  const [status, setStatus] = useState<SlugStatus>("idle");

  const check = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setStatus("invalid");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(value) || value.startsWith("-") || value.endsWith("-")) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    try {
      const res  = await fetch(`/api/business/check-slug?slug=${encodeURIComponent(value)}`);
      const json = await res.json();
      setStatus(json.available ? "available" : "taken");
    } catch {
      setStatus("idle");
    }
  }, []);

  // Debounced check
  useEffect(() => {
    const timer = setTimeout(() => check(slug), 500);
    return () => clearTimeout(timer);
  }, [slug, check]);

  // Check suggestion on mount
  useEffect(() => {
    check(suggested);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (status !== "available") return;
    onNext({ slug });
  }

  const statusIcon = {
    checking:  <Loader2 size={15} className="animate-spin text-[var(--color-text-muted)]" />,
    available: <CheckCircle size={15} className="text-green-500" />,
    taken:     <XCircle size={15} className="text-red-500" />,
    invalid:   <XCircle size={15} className="text-red-400" />,
    idle:      null,
  }[status];

  const statusMessage = {
    checking:  "جاري التحقق...",
    available: "الرابط متاح ✓",
    taken:     "هذا الرابط محجوز، جرّب آخر",
    invalid:   "أحرف إنجليزية صغيرة وأرقام وشرطات فقط (لا يبدأ/ينتهي بشرطة)",
    idle:      "",
  }[status];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-[var(--color-text-primary)] mb-1">
          رابط صفحتك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          سيستخدم عملاؤك هذا الرابط للحجز مباشرة
        </p>
      </div>

      {/* Slug input */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          الرابط المخصص
        </label>

        {/* URL preview */}
        <div className="flex items-center border border-[var(--color-border)] rounded-xl overflow-hidden focus-within:border-[var(--color-brand)] focus-within:ring-1 focus-within:ring-[var(--color-brand)]/20 transition-all">
          <span className="bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-muted)] border-e border-[var(--color-border)] shrink-0 select-none">
            maw3ed.com/company/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="bella-salon"
            dir="ltr"
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent text-[var(--color-text-primary)]"
            spellCheck={false}
          />
          <span className="px-3 shrink-0">{statusIcon}</span>
        </div>

        {statusMessage && (
          <p
            className={`mt-1.5 text-xs ${
              status === "available"
                ? "text-green-600"
                : status === "taken" || status === "invalid"
                ? "text-red-500"
                : "text-[var(--color-text-muted)]"
            }`}
          >
            {statusMessage}
          </p>
        )}
      </div>

      {/* Tips */}
      <div className="bg-[var(--color-surface-2)] rounded-xl p-4 space-y-1.5">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
          نصائح لاختيار رابط جيد:
        </p>
        {[
          "استخدم اسم عملك بالإنجليزية",
          "ابدأ بحرف وليس رقم",
          "تجنب الرموز الخاصة",
          "مثال: dr-ahmed-clinic أو bella-salon",
        ].map((tip) => (
          <p key={tip} className="text-xs text-[var(--color-text-muted)]">
            • {tip}
          </p>
        ))}
      </div>

      {/* Full URL preview */}
      {status === "available" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600 mb-1">صفحتك ستكون على:</p>
          <p className="text-sm font-semibold text-green-700" dir="ltr">
            maw3ed.com/company/{slug}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          → رجوع
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1"
          disabled={status !== "available"}
          onClick={handleNext}
        >
          معاينة ←
        </Button>
      </div>
    </div>
  );
}
