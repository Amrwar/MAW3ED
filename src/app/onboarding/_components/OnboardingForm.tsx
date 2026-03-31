"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Category, City } from "@prisma/client";
import { CheckCircle } from "lucide-react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Details from "./Step2Details";
import Step3Services from "./Step3Services";
import Step4Availability from "./Step4Availability";
import Step5Slug from "./Step5Slug";
import Step6Preview from "./Step6Preview";

export type ServiceItem = {
  nameAr:        string;
  nameEn?:       string;
  descriptionAr?: string;
  duration:      number;
  price:         number;
};

export type AvailabilityDay = {
  dayOfWeek: number;
  dayAr:     string;
  openTime:  string;
  closeTime: string;
  isClosed:  boolean;
};

export type OnboardingData = {
  nameAr:       string;
  nameEn:       string;
  categoryId:   string;
  cityId:       string;
  phone:        string;
  whatsapp:     string;
  address:      string;
  taglineAr:    string;
  about:        string;
  services:     ServiceItem[];
  availability: AvailabilityDay[];
  slug:         string;
};

const DEFAULT_AVAILABILITY: AvailabilityDay[] = [
  { dayOfWeek: 0, dayAr: "الأحد",     openTime: "09:00", closeTime: "21:00", isClosed: false },
  { dayOfWeek: 1, dayAr: "الاثنين",   openTime: "09:00", closeTime: "21:00", isClosed: false },
  { dayOfWeek: 2, dayAr: "الثلاثاء",  openTime: "09:00", closeTime: "21:00", isClosed: false },
  { dayOfWeek: 3, dayAr: "الأربعاء",  openTime: "09:00", closeTime: "21:00", isClosed: false },
  { dayOfWeek: 4, dayAr: "الخميس",    openTime: "09:00", closeTime: "21:00", isClosed: false },
  { dayOfWeek: 5, dayAr: "الجمعة",    openTime: "10:00", closeTime: "14:00", isClosed: true  },
  { dayOfWeek: 6, dayAr: "السبت",     openTime: "10:00", closeTime: "16:00", isClosed: false },
];

const STEPS = [
  { num: 1, label: "بياناتك",     icon: "🏢" },
  { num: 2, label: "التفاصيل",    icon: "📋" },
  { num: 3, label: "الخدمات",     icon: "⚙️" },
  { num: 4, label: "أوقات العمل", icon: "🕐" },
  { num: 5, label: "رابطك",       icon: "🔗" },
  { num: 6, label: "معاينة",      icon: "👁️" },
];

interface Props {
  categories: Category[];
  cities:     City[];
}

export default function OnboardingForm({ categories, cities }: Props) {
  const router  = useRouter();
  const { update } = useSession();

  const [step, setStep]         = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    nameAr:       "",
    nameEn:       "",
    categoryId:   "",
    cityId:       "",
    phone:        "",
    whatsapp:     "",
    address:      "",
    taglineAr:    "",
    about:        "",
    services:     [],
    availability: DEFAULT_AVAILABILITY,
    slug:         "",
  });

  function patch(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }));
  }

  function next(partial?: Partial<OnboardingData>) {
    if (partial) patch(partial);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "حدث خطأ أثناء الحفظ");
        setIsSubmitting(false);
        return;
      }

      // Refresh JWT to include businessId
      await update();
      router.push("/dashboard");
      router.refresh();
    } catch {
      setSubmitError("حدث خطأ في الاتصال بالسيرفر");
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      {/* Progress stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          {/* Track line */}
          <div className="absolute top-4 start-0 end-0 h-0.5 bg-[var(--color-border)] -z-10" />
          <div
            className="absolute top-4 start-0 h-0.5 bg-[var(--color-brand)] -z-10 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((s) => (
            <div key={s.num} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                  step > s.num
                    ? "bg-[var(--color-brand)] text-white"
                    : step === s.num
                    ? "bg-[var(--color-brand)] text-white ring-4 ring-[var(--color-brand)]/20"
                    : "bg-white border-2 border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}
              >
                {step > s.num ? <CheckCircle size={14} /> : s.icon}
              </div>
              <span
                className={`text-[10px] font-medium hidden sm:block ${
                  step >= s.num
                    ? "text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="card p-6 md:p-8">
        {step === 1 && (
          <Step1BasicInfo
            data={data}
            categories={categories}
            cities={cities}
            onNext={(d) => next(d)}
          />
        )}
        {step === 2 && (
          <Step2Details data={data} onNext={(d) => next(d)} onBack={back} />
        )}
        {step === 3 && (
          <Step3Services data={data} onNext={(d) => next(d)} onBack={back} />
        )}
        {step === 4 && (
          <Step4Availability data={data} onNext={(d) => next(d)} onBack={back} />
        )}
        {step === 5 && (
          <Step5Slug data={data} onNext={(d) => next(d)} onBack={back} />
        )}
        {step === 6 && (
          <Step6Preview
            data={data}
            categories={categories}
            cities={cities}
            onSubmit={submit}
            onBack={back}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
}
