"use client";

import { Stethoscope, Scissors, Dumbbell, Flower2, Smile, Eye, HeartPulse, Briefcase } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Icons rather than emoji — emoji render differently on every
 * platform and read as unfinished on a commercial marketplace.
 */
const BUSINESS_TYPES = [
  { Icon: Stethoscope, ar: "عيادات طبية",   en: "Medical clinics" },
  { Icon: Scissors,    ar: "صالونات تجميل", en: "Salons" },
  { Icon: Dumbbell,    ar: "صالات رياضة",   en: "Gyms" },
  { Icon: Flower2,     ar: "سبا ومساج",     en: "Spa & massage" },
  { Icon: Smile,       ar: "عيادات أسنان",  en: "Dental" },
  { Icon: Eye,         ar: "عيادات عيون",   en: "Optical" },
  { Icon: HeartPulse,  ar: "مراكز علاج",    en: "Therapy centres" },
  { Icon: Briefcase,   ar: "استشارات",      en: "Consulting" },
];

export default function TrustStats() {
  const { t, lang } = useLanguage();
  const items = t.trustStats.items;

  return (
    <section className="border-y border-[var(--color-line)] bg-[var(--color-surface)] py-14">
      <div className="container-app">

        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-[2rem] font-light leading-none tracking-tight text-[var(--color-ink)]" style={{ unicodeBidi: "plaintext" }}>
                {item.value}
              </p>
              <p className="mt-3 text-sm font-bold text-[var(--color-ink)]">{item.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-subtle)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mb-7 flex items-center gap-5">
          <span className="section-eyebrow whitespace-nowrap">
            {lang === "ar" ? "يخدم كل أنواع الأنشطة" : "All business types"}
          </span>
          <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-line)]" />
        </div>

        <ul className="flex flex-wrap gap-2.5">
          {BUSINESS_TYPES.map(({ Icon, ar, en }) => (
            <li
              key={ar}
              className="flex items-center gap-2.5 rounded-full border border-[var(--color-line)] bg-[var(--color-ground)] px-4 py-2.5 text-[0.84375rem] text-[var(--color-muted)]"
            >
              <Icon size={15} strokeWidth={1.7} className="text-[var(--color-jade)]" aria-hidden="true" />
              {lang === "ar" ? ar : en}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
