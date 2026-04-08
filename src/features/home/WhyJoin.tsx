"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Link2, CalendarCheck2, BellRing, BarChart3, Star, Gift,
  Check, TrendingUp, Clock, ArrowUpRight, ArrowRight,
} from "lucide-react";

// ─── Icon map ──────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  "📲": <Link2      size={18} />,
  "🗓️": <CalendarCheck2 size={18} />,
  "🔔": <BellRing  size={18} />,
  "📊": <BarChart3 size={18} />,
  "⭐": <Star      size={18} />,
  "🆓": <Gift      size={18} />,
};

// ─── Dashboard mockup ──────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[420px] mx-auto select-none" dir="rtl">

      {/* ── Floating notification card (top-right) ── */}
      <div
        className="absolute -top-6 -right-4 z-30 bg-white rounded-2xl border border-[#E2E8F0] px-4 py-3 flex items-center gap-3"
        style={{
          minWidth: 210,
          boxShadow: "0 8px 30px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <div className="w-8 h-8 bg-green-50 border border-green-100 rounded-full flex items-center justify-center shrink-0">
          <Check size={13} className="text-green-600" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-[#0F172A]">حجز جديد تم تأكيده</p>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">محمد أحمد · كشف باطنة · ١٠:٠٠</p>
        </div>
      </div>

      {/* ── Main dashboard card ── */}
      <div
        className="bg-white rounded-3xl border border-[#E2E8F0] overflow-hidden mt-6"
        style={{ boxShadow: "0 20px 60px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.06)" }}
      >

        {/* Card header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%)" }}
        >
          <div>
            <p className="text-white font-bold text-sm">لوحة التحكم</p>
            <p className="text-blue-300 text-xs mt-0.5">عيادة د. أحمد السيد</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
            <span className="text-green-300 text-[10px] font-semibold">مفتوح الآن</span>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { value: "٣٢١",   label: "حجز",    sub: "هذا الشهر", color: "text-[#3B82F6]", bg: "bg-[#EFF6FF]",   border: "border-[#BFDBFE]" },
            { value: "٢٣.٥ك", label: "إيراد",  sub: "جنيه",      color: "text-[#7C3AED]", bg: "bg-violet-50",  border: "border-violet-100" },
            { value: "٩٨٪",   label: "رضا",    sub: "العملاء",   color: "text-[#059669]", bg: "bg-emerald-50", border: "border-emerald-100" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} border ${stat.border} rounded-xl p-3 text-center`}
            >
              <p className={`text-lg font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-[10px] font-semibold text-[#0F172A] mt-0.5">{stat.label}</p>
              <p className="text-[9px] text-[#94A3B8]">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Mini chart bar (decorative) */}
        <div className="px-4 pb-3">
          <div className="flex items-end gap-1 h-10">
            {[40, 65, 50, 80, 70, 90, 75, 95, 60, 85, 100, 78].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${h}%`,
                  background: i === 10
                    ? "#3B82F6"
                    : `rgba(59,130,246,${0.12 + (i / 11) * 0.22})`,
                }}
              />
            ))}
          </div>
          <p className="text-[9px] text-[#94A3B8] mt-1.5">الحجوزات خلال آخر ١٢ شهر</p>
        </div>

        {/* Booking list */}
        <div className="border-t border-[#F1F5F9] px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-[#0F172A]">آخر الحجوزات</p>
            <span className="text-[10px] text-[#3B82F6] font-semibold">عرض الكل</span>
          </div>
          <div className="space-y-2.5">
            {[
              { name: "محمد أحمد",  svc: "كشف باطنة", time: "١٠:٠٠", status: "confirmed" },
              { name: "سارة محمود", svc: "استشارة",   time: "١١:٠٠", status: "pending"   },
              { name: "أحمد علي",   svc: "كشف قلبي",  time: "١٢:٠٠", status: "confirmed" },
            ].map((b) => (
              <div key={b.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center shrink-0 text-[10px]">
                    👤
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#0F172A] truncate">{b.name}</p>
                    <p className="text-[9px] text-[#94A3B8] truncate">{b.svc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] text-[#94A3B8] flex items-center gap-0.5">
                    <Clock size={8} /> {b.time}
                  </span>
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      b.status === "confirmed"
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        : "bg-amber-50 text-amber-600 border border-amber-100"
                    }`}
                  >
                    {b.status === "confirmed" ? "مؤكد" : "انتظار"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Floating link card (bottom-left) ── */}
      <div
        className="absolute -bottom-5 -left-4 z-30 bg-white rounded-2xl border border-[#E2E8F0] px-4 py-3"
        style={{
          minWidth: 200,
          boxShadow: "0 8px 30px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.06)",
        }}
      >
        <p className="text-[10px] text-[#94A3B8] mb-1">رابط الحجز الخاص بك</p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#3B82F6] truncate" dir="ltr">
            maw3ed.com/dr-ahmed
          </span>
          <ArrowUpRight size={13} className="text-[#3B82F6] shrink-0" />
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#EFF6FF] overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-[#3B82F6]" />
        </div>
        <p className="text-[9px] text-[#94A3B8] mt-1">٧٥٪ نسبة إتمام الحجز</p>
      </div>

      {/* ── Floating rating badge (top-left) ── */}
      <div
        className="absolute top-2 -left-4 z-30 bg-[#0F172A] rounded-xl px-3 py-2 flex items-center gap-1.5"
        style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.25)" }}
      >
        <Star size={12} className="text-amber-400 fill-amber-400" />
        <span className="text-white text-xs font-bold">٤.٩</span>
        <span className="text-slate-500 text-[10px]">تقييم</span>
      </div>

      {/* ── Rising metric badge (far right) ── */}
      <div
        className="absolute top-1/2 -right-5 -translate-y-1/2 z-30 bg-white border border-emerald-100 rounded-xl px-3 py-2 flex items-center gap-1.5"
        style={{ boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }}
      >
        <TrendingUp size={14} className="text-[#059669]" />
        <span className="text-[11px] font-bold text-[#059669]">+٢٤٪</span>
      </div>
    </div>
  );
}

// ─── Main section ──────────────────────────────────────────

export default function WhyJoin() {
  const { t, lang } = useLanguage();
  const w = t.whyJoin;

  return (
    <section
      className="relative overflow-hidden py-24 lg:py-32"
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ background: "#F8FAFC" }}
    >

      {/* ── Background layers ── */}

      {/* Very faint dot grid — extremely subtle */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.18) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top-edge fade so grid fades in gently */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #F8FAFC, transparent)" }}
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
        style={{ background: "linear-gradient(to top, #F8FAFC, transparent)" }}
      />

      {/* Primary blue radial glow — mockup side (start) */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: "-5%",
          top: "15%",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.07) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)",
          filter: "blur(1px)",
        }}
      />

      {/* Secondary glow — cards side (end) */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineEnd: "-8%",
          top: "30%",
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 65%)",
          filter: "blur(2px)",
        }}
      />

      {/* Warm center ambient — keeps the middle from feeling cold */}
      <div
        aria-hidden
        className="absolute pointer-events-none left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 900,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(219,234,254,0.22) 0%, transparent 70%)",
        }}
      />

      <div className="container-app relative z-10">

        {/* ── Section header ── */}
        <div className="text-center mb-16 lg:mb-20">

          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
            style={{
              background: "rgba(219,234,254,0.7)",
              border: "1px solid rgba(147,197,253,0.6)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]"
              style={{ boxShadow: "0 0 6px rgba(59,130,246,0.5)" }}
            />
            <span className="text-[#2563EB] text-xs font-semibold tracking-widest uppercase">
              {w.eyebrow}
            </span>
          </div>

          {/* Heading */}
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] mb-5"
            style={{ lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            {w.title}{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 80%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {w.titleLine2}
            </span>
          </h2>

          <p
            className="text-[#475569] text-lg max-w-xl mx-auto"
            style={{ lineHeight: 1.75 }}
          >
            {w.subtitle}
          </p>
        </div>

        {/* ── Two-column: mockup + features ── */}
        <div
          className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16"
          dir="ltr"
        >

          {/* ── Left: Dashboard mockup ── */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[440px] py-10 px-6">

              {/* Spotlight glow behind mockup */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.10) 0%, transparent 65%)",
                  filter: "blur(8px)",
                }}
              />

              <DashboardMockup />
            </div>
          </div>

          {/* ── Right: Feature cards grid ── */}
          <div dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="grid sm:grid-cols-2 gap-4">
              {w.benefits.map((benefit, i) => {
                const isHighlighted = i === 1;
                return (
                  <div
                    key={benefit.title}
                    className={`group relative p-6 rounded-2xl border transition-all duration-250 cursor-default ${
                      isHighlighted
                        ? "border-[#3B82F6]/30 bg-white"
                        : "border-[#E2E8F0] bg-white hover:border-[#93C5FD]"
                    }`}
                    style={
                      isHighlighted
                        ? {
                            boxShadow: "0 4px 24px rgba(59,130,246,0.10), 0 1px 4px rgba(15,23,42,0.05)",
                          }
                        : {
                            boxShadow: "0 1px 4px rgba(15,23,42,0.04)",
                          }
                    }
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow =
                        "0 8px 32px rgba(59,130,246,0.12), 0 2px 8px rgba(15,23,42,0.06)";
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = isHighlighted
                        ? "0 4px 24px rgba(59,130,246,0.10), 0 1px 4px rgba(15,23,42,0.05)"
                        : "0 1px 4px rgba(15,23,42,0.04)";
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                    }}
                  >
                    {/* Top accent line on highlighted */}
                    {isHighlighted && (
                      <div
                        className="absolute top-0 inset-x-0 h-[2px] rounded-t-2xl"
                        style={{ background: "linear-gradient(90deg, #3B82F6, #6366F1)" }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors duration-200 ${
                        isHighlighted
                          ? "bg-[#3B82F6] text-white"
                          : "bg-[#EFF6FF] text-[#3B82F6] group-hover:bg-[#3B82F6] group-hover:text-white"
                      }`}
                      style={isHighlighted ? { boxShadow: "0 4px 12px rgba(59,130,246,0.30)" } : {}}
                    >
                      {ICON_MAP[benefit.icon] ?? <span className="text-lg">{benefit.icon}</span>}
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] mb-1.5 leading-snug tracking-tight">
                      {benefit.title}
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* CTA buttons */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup?type=business"
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)",
                  boxShadow: "0 4px 16px rgba(59,130,246,0.30), 0 1px 4px rgba(59,130,246,0.20)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                    "0 8px 24px rgba(59,130,246,0.40), 0 2px 8px rgba(59,130,246,0.25)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                    "0 4px 16px rgba(59,130,246,0.30), 0 1px 4px rgba(59,130,246,0.20)";
                }}
              >
                {w.cta1}
                <ArrowRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                  style={{ transform: lang === "ar" ? "scaleX(-1)" : undefined }}
                />
              </Link>
              <Link
                href="/for-business"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-[#475569] border border-[#E2E8F0] bg-white hover:border-[#93C5FD] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all duration-200"
                style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
              >
                {w.cta2}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Bottom trust bar ── */}
        <div
          className="pt-8 mt-2"
          style={{ borderTop: "1px solid rgba(226,232,240,0.8)" }}
        >
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {w.bullets.map((bullet) => (
              <div key={bullet} className="flex items-center gap-2 text-sm text-[#64748B]">
                <span
                  className="w-5 h-5 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0"
                >
                  <Check size={10} className="text-[#3B82F6]" strokeWidth={2.5} />
                </span>
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
