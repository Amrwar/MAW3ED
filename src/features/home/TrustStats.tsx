"use client";

import { useLanguage } from "@/contexts/LanguageContext";

const BUSINESS_TYPES = [
  { icon: "🏥", label: "عيادات طبية" },
  { icon: "✂️", label: "صالونات تجميل" },
  { icon: "💪", label: "صالات رياضة" },
  { icon: "🧖", label: "سبا ومساج" },
  { icon: "🦷", label: "عيادات أسنان" },
  { icon: "👁️", label: "عيادات عيون" },
  { icon: "💆", label: "مراكز علاج" },
  { icon: "📋", label: "استشارات" },
];

export default function TrustStats() {
  const { t, lang } = useLanguage();
  const items = t.trustStats.items;

  return (
    <section
      className="py-14 border-b border-[#E2E8F0]"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-3xl font-black text-[#0F172A] mb-1">{item.value}</p>
              <p className="text-sm font-semibold text-[#0F172A]">{item.label}</p>
              <p className="text-xs text-[#94A3B8] mt-0.5">{item.description}</p>
            </div>
          ))}
        </div>

        {/* Divider with label */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-[#E2E8F0]" />
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-widest whitespace-nowrap">
            {lang === "ar" ? "يخدم جميع أنواع الأعمال" : "All business types"}
          </span>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>

        {/* Business types */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {BUSINESS_TYPES.map((type) => (
            <div
              key={type.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#E2E8F0] bg-white text-sm font-medium text-[#475569] hover:border-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#DBEAFE] transition-all cursor-default"
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
