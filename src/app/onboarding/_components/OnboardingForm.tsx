"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { Category, City } from "@prisma/client";
import { CheckCircle, Store, ClipboardList, Settings2, Clock, Rocket } from "lucide-react";
import Step1BasicInfo from "./Step1BasicInfo";
import Step2Details from "./Step2Details";
import Step3Services from "./Step3Services";
import Step4Availability from "./Step4Availability";
import Step5Finish from "./Step5Finish";
import SuccessScreen from "./SuccessScreen";

export type ServiceItem = {
  nameAr:         string;
  nameEn?:        string;
  descriptionAr?: string;
  duration:       number;
  price:          number;
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
  coverImage?:  string;
  logoImage?:   string;
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

const DEFAULT_DATA: OnboardingData = {
  nameAr: "", nameEn: "", categoryId: "", cityId: "",
  phone: "", whatsapp: "", address: "", taglineAr: "", about: "",
  services: [], availability: DEFAULT_AVAILABILITY, slug: "",
};

const STEPS = [
  { num: 1, label: "بياناتك",     Icon: Store },
  { num: 2, label: "التفاصيل",    Icon: ClipboardList },
  { num: 3, label: "الخدمات",     Icon: Settings2 },
  { num: 4, label: "أوقات العمل", Icon: Clock },
  { num: 5, label: "الإطلاق",     Icon: Rocket },
] as const;

const STORAGE_KEY = "maw3ed_onboarding";

interface Props {
  categories: Category[];
  cities:     City[];
}

export default function OnboardingForm({ categories, cities }: Props) {
  const router      = useRouter();
  const { update }  = useSession();

  const [step,         setStep]         = useState(1);
  const [data,         setData]         = useState<OnboardingData>(DEFAULT_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState<{ slug: string; nameAr: string; published: boolean } | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const { step: savedStep, data: savedData } = JSON.parse(saved) as {
        step: number;
        data: OnboardingData;
      };
      if (savedData?.nameAr) {
        // localStorage exists only in the browser, so the saved draft can
        // only be read after hydration: an effect is the right place.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setData(savedData);
        setStep(Math.min(Math.max(savedStep, 1), STEPS.length));
      }
    } catch {}
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    if (submitted) return; // don't save after success
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }));
    } catch {}
  }, [step, data, submitted]);

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

  async function submit(finalData: OnboardingData) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...finalData,
          availability: finalData.availability.map(({ dayOfWeek, openTime, closeTime, isClosed }) => ({
            dayOfWeek, openTime, closeTime, isClosed,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "حدث خطأ أثناء الحفظ");
        return;
      }
      // Refresh session JWT to include new businessId
      await update();
      // Clear saved progress
      localStorage.removeItem(STORAGE_KEY);
      // Show success screen
      setSubmitted({ slug: finalData.slug, nameAr: finalData.nameAr, published: json.business?.isPublished === true });
    } catch {
      setSubmitError("حدث خطأ في الاتصال بالسيرفر");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────
  if (submitted) {
    return (
      <SuccessScreen
        slug={submitted.slug}
        nameAr={submitted.nameAr}
        published={submitted.published}
        onDashboard={() => router.push("/dashboard")}
      />
    );
  }

  // ── Step content ───────────────────────────────────────────
  return (
    <div>
      {/* ── Progress stepper ── */}
      <div className="mb-9">
        <ol className="relative flex items-start justify-between">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-[1.125rem] -z-10 h-0.5 bg-[var(--color-line)]"
          />
          <span
            aria-hidden="true"
            className="absolute start-0 top-[1.125rem] -z-10 h-0.5 bg-[var(--color-jade)] transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((s) => {
            const done = step > s.num;
            const current = step === s.num;
            return (
              <li key={s.num} className="flex flex-col items-center gap-2">
                <span
                  aria-current={current ? "step" : undefined}
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[0.8125rem] font-bold transition-colors ${
                    done || current
                      ? "bg-[var(--color-jade)] text-white"
                      : "border-[1.5px] border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-subtle)]"
                  }`}
                >
                  {done ? <CheckCircle size={16} aria-hidden="true" /> : <s.Icon size={16} strokeWidth={1.9} aria-hidden="true" />}
                </span>
                <span
                  className={`hidden text-[0.6875rem] sm:block ${
                    step >= s.num
                      ? "font-bold text-[var(--color-ink)]"
                      : "text-[var(--color-subtle)]"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="m-0 mt-5 text-center text-xs text-[var(--color-subtle)]">
          الخطوة <span className="num">{step}</span> من <span className="num">{STEPS.length}</span>
        </p>
      </div>

      {/* Card */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 md:p-9">
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
          <Step5Finish
            data={data}
            categories={categories}
            cities={cities}
            onBack={back}
            onSubmit={(finalData) => {
              patch(finalData);
              submit({ ...data, ...finalData });
            }}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  );
}
