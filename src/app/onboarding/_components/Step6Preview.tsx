import { MapPin, Phone, Clock, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Category, City } from "@prisma/client";
import type { OnboardingData } from "./OnboardingForm";

const DAY_LABELS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

interface Props {
  data:        OnboardingData;
  categories:  Category[];
  cities:      City[];
  onSubmit:    () => void;
  onBack:      () => void;
  isSubmitting: boolean;
  submitError:  string | null;
}

export default function Step6Preview({
  data, categories, cities,
  onSubmit, onBack, isSubmitting, submitError,
}: Props) {
  const category = categories.find((c) => c.id === data.categoryId);
  const city     = cities.find((c) => c.id === data.cityId);
  const openDays = data.availability.filter((d) => !d.isClosed);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-1">
          معاينة صفحتك
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          هكذا ستبدو صفحتك للعملاء. يمكنك تعديل كل شيء لاحقًا.
        </p>
      </div>

      {/* Page preview card */}
      <div className="border-2 border-[var(--color-border)] rounded-2xl overflow-hidden">
        {/* Cover */}
        <div className="h-28 bg-gradient-to-br from-gray-200 to-gray-300 relative">
          <div className="absolute inset-0 flex items-center justify-center text-[var(--color-faint)] text-sm">
            صورة الغلاف
          </div>
        </div>

        {/* Business info */}
        <div className="p-5">
          <div className="flex items-start gap-4 -mt-10 mb-4">
            <div className="w-16 h-16 rounded-xl bg-white border-2 border-white shadow flex items-center justify-center text-2xl font-extrabold text-[var(--color-brand)] shrink-0">
              {data.nameAr[0] || "؟"}
            </div>
            <div className="pt-4">
              {category && (
                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                  {category.icon} {category.nameAr}
                </span>
              )}
              <h3 className="text-lg font-extrabold text-[var(--color-text-primary)]">
                {data.nameAr || "اسم العمل"}
              </h3>
              {data.taglineAr && (
                <p className="text-sm text-[var(--color-text-muted)]">{data.taglineAr}</p>
              )}
            </div>
          </div>

          {/* Info row */}
          <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-4 mb-4">
            {city && (
              <div className="flex items-center gap-1">
                <MapPin size={12} />
                <span>{city.nameAr}</span>
              </div>
            )}
            {data.phone && (
              <div className="flex items-center gap-1">
                <Phone size={12} />
                <span dir="ltr">{data.phone}</span>
              </div>
            )}
            {openDays.length > 0 && (
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>{openDays.length} أيام عمل</span>
              </div>
            )}
          </div>

          {/* Services preview */}
          {data.services.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">
                الخدمات ({data.services.length})
              </p>
              <div className="space-y-2">
                {data.services.slice(0, 3).map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 bg-[var(--color-surface-2)] rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {s.nameAr}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {s.duration} دقيقة
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-accent)]">
                      {s.price} ج
                    </span>
                  </div>
                ))}
                {data.services.length > 3 && (
                  <p className="text-xs text-[var(--color-text-muted)] text-center">
                    + {data.services.length - 3} خدمات أخرى
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* URL bar */}
        <div className="bg-[var(--color-surface-2)] border-t border-[var(--color-border)] px-5 py-3">
          <p className="text-xs text-[var(--color-text-muted)]" dir="ltr">
            maw3ed.com/company/
            <span className="font-semibold text-[var(--color-text-primary)]">
              {data.slug}
            </span>
          </p>
        </div>
      </div>

      {/* Summary checklist */}
      <div className="space-y-2">
        {[
          { label: "اسم العمل", done: !!data.nameAr },
          { label: "التخصص والمدينة", done: !!data.categoryId && !!data.cityId },
          { label: "رقم الهاتف", done: !!data.phone },
          { label: `${data.services.length} خدمة`, done: data.services.length > 0 },
          { label: `${openDays.length} أيام عمل`, done: openDays.length > 0 },
          { label: `الرابط: /${data.slug}`, done: !!data.slug },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <CheckCircle
              size={14}
              className={item.done ? "text-[var(--color-ok)]" : "text-[var(--color-border-2)]"}
            />
            <span
              className={
                item.done
                  ? "text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-muted)]"
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {submitError && (
        <div className="bg-[var(--color-danger-soft)] border border-[var(--color-danger-line)] text-[var(--color-danger)] text-sm rounded-xl px-4 py-3">
          {submitError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
          → تعديل
        </Button>
        <Button
          type="button"
          variant="accent"
          className="flex-1"
          isLoading={isSubmitting}
          onClick={onSubmit}
        >
          🚀 أطلق صفحتك!
        </Button>
      </div>
    </div>
  );
}
