"use client";

import Link from "next/link";
import { Check, Zap, Crown, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const PLAN_ICONS = [
  <Star key="s" size={20} className="text-[#64748B]" />,
  <Zap key="z" size={20} className="text-[#3B82F6]" />,
  <Crown key="c" size={20} className="text-[#7C3AED]" />,
];

export default function PricingPreview() {
  const { t, lang } = useLanguage();
  const p = t.pricingPreview;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#F8FAFC" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-4 tracking-wide uppercase">
            {p.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3">{p.title}</h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto">{p.subtitle}</p>
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {p.plans.map((plan, i) => {
            const isFeatured = i === 1;
            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-7 flex flex-col transition-all ${
                  isFeatured
                    ? "border-2 border-[#3B82F6] bg-white shadow-2xl shadow-blue-100 scale-[1.02]"
                    : "border border-[#E2E8F0] bg-white hover:shadow-lg hover:-translate-y-0.5"
                }`}
              >
                {/* Popular badge */}
                {isFeatured && (
                  <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                    <span className="px-4 py-1 rounded-full text-xs font-bold bg-[#3B82F6] text-white shadow">
                      {p.badge}
                    </span>
                  </div>
                )}

                {/* Plan icon & name */}
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isFeatured ? "bg-[#DBEAFE]" : "bg-[#F1F5F9]"
                  }`}>
                    {PLAN_ICONS[i]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">{plan.name}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6 pb-6 border-b border-[#E2E8F0]">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-black ${isFeatured ? "text-[#3B82F6]" : "text-[#0F172A]"}`}>
                      {plan.price}
                    </span>
                    {parseInt(String(plan.price)) > 0 && (
                      <span className="text-sm text-[#94A3B8]">{lang === "ar" ? "ج.م" : "EGP"}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#94A3B8] mt-1">{plan.period}</p>
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-7">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={15}
                        className={`mt-0.5 shrink-0 ${isFeatured ? "text-[#3B82F6]" : "text-[#10B981]"}`}
                        strokeWidth={2.5}
                      />
                      <span className="text-[#475569]">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href="/signup?type=business"
                  className={`block w-full py-3 rounded-xl text-center font-bold text-sm transition-all ${
                    isFeatured
                      ? "bg-[#3B82F6] text-white hover:bg-[#2563EB] shadow-md shadow-blue-200"
                      : "border border-[#E2E8F0] text-[#0F172A] hover:border-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#DBEAFE]"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* View all link */}
        <p className="text-center mt-10">
          <Link
            href="/pricing"
            className="text-sm font-semibold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            {p.viewAll}
          </Link>
        </p>
      </div>
    </section>
  );
}
