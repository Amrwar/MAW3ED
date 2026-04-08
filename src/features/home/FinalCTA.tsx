"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinalCTA() {
  const { t, lang } = useLanguage();
  const c = t.finalCta;

  return (
    <section
      className="relative overflow-hidden py-24 lg:py-32"
      style={{ background: "#0F172A" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Grid pattern */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glows */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 inset-x-0 h-px opacity-30"
          style={{ background: "linear-gradient(to right, transparent, #3B82F6, transparent)" }}
        />
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
        />
      </div>

      <div className="container-app relative z-10 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
          <span className="text-[#93C5FD] text-xs font-semibold tracking-wide uppercase">{c.eyebrow}</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
          {c.title}
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #60A5FA 0%, #A78BFA 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {c.titleLine2}
          </span>
        </h2>

        <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto leading-relaxed mb-10">
          {c.subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <Link
            href="/businesses"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-sm shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
            style={{ background: "#3B82F6" }}
          >
            {c.cta1}
          </Link>
          <Link
            href="/signup?type=business"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/10 hover:border-white/30 transition-all"
          >
            {c.cta2}
          </Link>
        </div>

        {/* Reassurance note */}
        <p className="text-xs text-[#475569]">{c.note}</p>
      </div>
    </section>
  );
}
