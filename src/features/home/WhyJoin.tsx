"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Link2, CalendarCheck2, BellRing, BarChart3, Star, Gift
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  "📲": <Link2 size={22} className="text-[#3B82F6]" />,
  "🗓️": <CalendarCheck2 size={22} className="text-[#3B82F6]" />,
  "🔔": <BellRing size={22} className="text-[#3B82F6]" />,
  "📊": <BarChart3 size={22} className="text-[#3B82F6]" />,
  "⭐": <Star size={22} className="text-[#3B82F6]" />,
  "🆓": <Gift size={22} className="text-[#3B82F6]" />,
};

export default function WhyJoin() {
  const { t, lang } = useLanguage();
  const w = t.whyJoin;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#FFFFFF" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">

        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#DBEAFE] text-[#3B82F6] mb-4 tracking-wide uppercase">
            {w.eyebrow}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] mb-4">
            {w.title}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {w.titleLine2}
            </span>
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto leading-relaxed">
            {w.subtitle}
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-14">
          {w.benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="group p-6 rounded-2xl border border-[#E2E8F0] bg-white hover:border-[#3B82F6]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[#DBEAFE] flex items-center justify-center mb-4">
                {ICON_MAP[benefit.icon] ?? <span className="text-xl">{benefit.icon}</span>}
              </div>
              <h3 className="text-base font-bold text-[#0F172A] mb-2">{benefit.title}</h3>
              <p className="text-sm text-[#475569] leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup?type=business"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
            style={{ background: "#3B82F6" }}
          >
            {w.cta1}
          </Link>
          <Link
            href="/for-business"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm border border-[#E2E8F0] text-[#475569] hover:border-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#DBEAFE] transition-all"
          >
            {w.cta2}
          </Link>
        </div>
      </div>
    </section>
  );
}
