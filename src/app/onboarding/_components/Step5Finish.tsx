"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, Loader2, MapPin, Phone, Clock,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { makeSlug } from "@/lib/slug";
import type { Category, City } from "@prisma/client";
import type { OnboardingData } from "./OnboardingForm";
import { SITE_HOST } from "@/lib/url";

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface Props {
  data:         OnboardingData;
  categories:   Category[];
  cities:       City[];
  onBack:       () => void;
  onSubmit:     (finalData: Partial<OnboardingData>) => void;
  isSubmitting: boolean;
  submitError:  string | null;
}

export default function Step5Finish({
  data, categories, cities,
  onBack, onSubmit, isSubmitting, submitError,
}: Props) {
  // Lazily computed once. Calling Math.random() during render would
  // hand back a different suggestion on every re-render.
  const [slug, setSlug] = useState(
    () =>
      data.slug ||
      makeSlug(data.nameEn || "") ||
      `business-${Math.random().toString(36).slice(2, 7)}`,
  );
  const [status, setStatus] = useState<SlugStatus>("idle");

  const check = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setStatus("invalid"); return;
    }
    if (!/^[a-z0-9-]+$/.test(value) || value.startsWith("-") || value.endsWith("-")) {
      setStatus("invalid"); return;
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

  useEffect(() => {
    const t = setTimeout(() => check(slug), 500);
    return () => clearTimeout(t);
  }, [slug, check]);

  const category  = categories.find((c) => c.id === data.categoryId);
  const city      = cities.find((c) => c.id === data.cityId);
  const openDays  = data.availability.filter((d) => !d.isClosed);
  const canSubmit = status === "available" && !isSubmitting;

  const statusIcon = {
    checking:  <Loader2 size={15} className="animate-spin text-[var(--color-text-muted)]" />,
    available: <CheckCircle size={15} className="text-[var(--color-ok)]" />,
    taken:     <XCircle size={15} className="text-[var(--color-danger)]" />,
    invalid:   <XCircle size={15} className="text-[var(--color-danger)]" />,
    idle:      null,
  }[status];

  const statusMsg = {
    checking:  "جاري التحقق...",
    available: "الرابط متاح ✓",
    taken:     "هذا الرابط محجوز، جرّب آخر",
    invalid:   "أحرف إنجليزية صغيرة وأرقام وشرطات فقط (لا يبدأ/ينتهي بشرطة)",
    idle:      "",
  }[status];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
          اختر رابطك وأطلق صفحتك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          خطوة أخيرة قبل أن تبدأ في استقبال الحجوزات
        </p>
      </div>

      {/* Slug input */}
      <div>
        <label className="field-label">
          رابطك المخصص <span className="text-[var(--color-danger)]">*</span>
        </label>
        <div className="flex items-center border border-[var(--color-border)] rounded-[var(--radius-md)] overflow-hidden focus-within:border-[var(--color-brand)] focus-within:ring-1 focus-within:ring-[var(--color-brand)]/20 transition-all">
          <span className="bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text-muted)] border-e border-[var(--color-border)] shrink-0 select-none whitespace-nowrap">
            {SITE_HOST}/company/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="bella-salon"
            dir="ltr"
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent text-[var(--color-text-primary)] min-w-0"
            spellCheck={false}
          />
          <span className="px-3 shrink-0">{statusIcon}</span>
        </div>
        {statusMsg && (
          <p className={`mt-1.5 text-xs ${
            status === "available"
              ? "text-[var(--color-ok)]"
              : status === "taken" || status === "invalid"
              ? "text-[var(--color-danger)]"
              : "text-[var(--color-text-muted)]"
          }`}>
            {statusMsg}
          </p>
        )}
      </div>

      {/* Preview card */}
      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        {/* Cover */}
        <div className="h-24 bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-surface-2)] relative">
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-xs">
            صورة الغلاف
          </div>
          {/* Logo */}
          <div className="absolute -bottom-6 start-4 w-14 h-14 rounded-[var(--radius-md)] bg-white border-2 border-white shadow-[var(--shadow-raised)] flex items-center justify-center text-xl font-extrabold text-[var(--color-brand)]">
            {data.nameAr[0] || "؟"}
          </div>
        </div>

        <div className="pt-9 px-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            {category && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {category.icon} {category.nameAr}
              </span>
            )}
          </div>
          <h3 className="text-base font-extrabold text-[var(--color-text-primary)]">
            {data.nameAr || "اسم العمل"}
          </h3>
          {data.taglineAr && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{data.taglineAr}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-muted)] mt-3">
            {city && (
              <span className="flex items-center gap-1"><MapPin size={11} />{city.nameAr}</span>
            )}
            {data.phone && (
              <span className="flex items-center gap-1" dir="ltr"><Phone size={11} />{data.phone}</span>
            )}
            {openDays.length > 0 && (
              <span className="flex items-center gap-1"><Clock size={11} />{openDays.length} أيام عمل</span>
            )}
          </div>

          {/* Services */}
          {data.services.length > 0 && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-3 space-y-1.5">
              {data.services.slice(0, 3).map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">{s.nameAr}</span>
                    <span className="text-[var(--color-text-muted)] ms-1.5">{s.duration} دقيقة</span>
                  </div>
                  <span className="font-bold text-[var(--color-accent)]">{s.price} ج</span>
                </div>
              ))}
              {data.services.length > 3 && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  +{data.services.length - 3} خدمات أخرى
                </p>
              )}
            </div>
          )}
        </div>

        {/* URL bar */}
        <div className="bg-[var(--color-surface-2)] border-t border-[var(--color-border)] px-5 py-2.5">
          <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
            {SITE_HOST}/company/
            <span className="font-semibold text-[var(--color-text-primary)]">{slug || "..."}</span>
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "اسم العمل",          done: !!data.nameAr },
          { label: "التخصص والمدينة",    done: !!data.categoryId && !!data.cityId },
          { label: "رقم الهاتف",         done: !!data.phone },
          { label: `${data.services.length} خدمة`, done: data.services.length > 0 },
          { label: `${openDays.length} أيام عمل`,  done: openDays.length > 0 },
          { label: "الرابط المخصص",      done: status === "available" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-xs">
            <CheckCircle
              size={13}
              className={item.done ? "text-[var(--color-ok)] shrink-0" : "text-[var(--color-border)] shrink-0"}
            />
            <span className={item.done ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {submitError && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-[var(--radius-md)] px-4 py-3">
          {submitError}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack} disabled={isSubmitting}>
          → تعديل
        </Button>
        <Button
          type="button"
          variant="accent"
          className="flex-1 gap-2"
          disabled={!canSubmit}
          isLoading={isSubmitting}
          onClick={() => canSubmit && onSubmit({ slug })}
        >
          {!isSubmitting && "🚀"} أطلق صفحتك!
        </Button>
      </div>
    </div>
  );
}
