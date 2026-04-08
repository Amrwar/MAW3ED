"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, CalendarDays, CheckCircle, Store, Share2, TrendingUp } from "lucide-react";

const CUSTOMER_ICONS = [
  <Search key="s" size={22} className="text-[#3B82F6]" />,
  <CalendarDays key="c" size={22} className="text-[#3B82F6]" />,
  <CheckCircle key="ch" size={22} className="text-[#3B82F6]" />,
];

const BUSINESS_ICONS = [
  <Store key="st" size={22} className="text-[#3B82F6]" />,
  <Share2 key="sh" size={22} className="text-[#3B82F6]" />,
  <TrendingUp key="t" size={22} className="text-[#3B82F6]" />,
];

export default function HowItWorks() {
  const { t, lang } = useLanguage();
  const h = t.howItWorks;
  const [tab, setTab] = useState<"customer" | "business">("customer");

  const steps    = tab === "customer" ? h.customerSteps : h.businessSteps;
  const icons    = tab === "customer" ? CUSTOMER_ICONS : BUSINESS_ICONS;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-4 tracking-wide uppercase">
            {h.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3">{h.title}</h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto">{h.subtitle}</p>
        </div>

        {/* Tab toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center p-1.5 rounded-2xl border border-[#E2E8F0] bg-white shadow-sm gap-1">
            <button
              onClick={() => setTab("customer")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === "customer"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              {h.forCustomers}
            </button>
            <button
              onClick={() => setTab("business")}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === "business"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              {h.forBusinesses}
            </button>
          </div>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop) */}
          <div
            className="hidden md:block absolute top-10 inset-x-[calc(100%/6)] h-px"
            style={{ background: "linear-gradient(to right, transparent, #DBEAFE 20%, #DBEAFE 80%, transparent)" }}
          />

          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative bg-white rounded-2xl p-7 border border-[#E2E8F0] hover:border-[#3B82F6]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all text-center"
            >
              {/* Step number badge */}
              <div className="absolute -top-4 inset-x-0 flex justify-center">
                <span className="w-8 h-8 rounded-full bg-[#0F172A] text-white text-xs font-black flex items-center justify-center border-2 border-white shadow-md">
                  {i + 1}
                </span>
              </div>

              {/* Icon */}
              <div className="w-14 h-14 rounded-2xl bg-[#DBEAFE] flex items-center justify-center mx-auto mb-5 mt-2">
                {icons[i]}
              </div>

              <h3 className="text-base font-bold text-[#0F172A] mb-2">{step.title}</h3>
              <p className="text-sm text-[#475569] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
