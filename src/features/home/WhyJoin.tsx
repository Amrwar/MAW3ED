"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Link2, CalendarCheck2, BellRing, BarChart3, Star, Gift,
  Check, TrendingUp, Clock, ArrowUpRight,
} from "lucide-react";

// ─── Icon map ──────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  "📲": <Link2      size={20} />,
  "🗓️": <CalendarCheck2 size={20} />,
  "🔔": <BellRing  size={20} />,
  "📊": <BarChart3 size={20} />,
  "⭐": <Star      size={20} />,
  "🆓": <Gift      size={20} />,
};

// ─── Dashboard mockup ──────────────────────────────────────

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-[420px] mx-auto select-none" dir="rtl">

      {/* ── Floating notification card (top-right) ── */}
      <div
        className="absolute -top-6 -right-4 z-30 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] px-4 py-3 flex items-center gap-3"
        style={{ minWidth: 210 }}
      >
        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
          <Check size={14} className="text-green-600" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-[#0F172A]">حجز جديد تم تأكيده</p>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">محمد أحمد · كشف باطنة · ١٠:٠٠</p>
        </div>
      </div>

      {/* ── Main dashboard card ── */}
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E2E8F0] overflow-hidden mt-6">

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
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-green-300 text-[10px] font-semibold">مفتوح الآن</span>
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { value: "٣٢١",   label: "حجز",    sub: "هذا الشهر", color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]"  },
            { value: "٢٣.٥ك", label: "إيراد",  sub: "جنيه",       color: "text-[#7C3AED]", bg: "bg-purple-50" },
            { value: "٩٨٪",   label: "رضا",    sub: "العملاء",    color: "text-[#10B981]", bg: "bg-emerald-50"},
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-xl p-3 text-center`}
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
                    : `rgba(59,130,246,${0.15 + (i / 11) * 0.25})`,
                }}
              />
            ))}
          </div>
          <p className="text-[9px] text-[#94A3B8] mt-1.5">الحجوزات خلال آخر ١٢ شهر</p>
        </div>

        {/* Booking list */}
        <div className="border-t border-[#E2E8F0] px-4 py-3">
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
                  <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center shrink-0 text-[10px]">
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
                        ? "bg-green-50 text-green-600"
                        : "bg-amber-50 text-amber-600"
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
        className="absolute -bottom-5 -left-4 z-30 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] px-4 py-3"
        style={{ minWidth: 200 }}
      >
        <p className="text-[10px] text-[#94A3B8] mb-1">رابط الحجز الخاص بك</p>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold text-[#3B82F6] truncate"
            dir="ltr"
          >
            maw3ed.com/dr-ahmed
          </span>
          <ArrowUpRight size={13} className="text-[#3B82F6] shrink-0" />
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#DBEAFE] overflow-hidden">
          <div className="h-full w-3/4 rounded-full bg-[#3B82F6]" />
        </div>
        <p className="text-[9px] text-[#94A3B8] mt-1">٧٥٪ نسبة إتمام الحجز</p>
      </div>

      {/* ── Floating rating badge (top-left) ── */}
      <div className="absolute top-2 -left-4 z-30 bg-[#0F172A] rounded-xl shadow-lg px-3 py-2 flex items-center gap-1.5">
        <Star size={12} className="text-amber-400 fill-amber-400" />
        <span className="text-white text-xs font-bold">٤.٩</span>
        <span className="text-[#64748B] text-[10px]">تقييم</span>
      </div>

      {/* ── Rising metric badge (far right) ── */}
      <div className="absolute top-1/2 -right-5 -translate-y-1/2 z-30 bg-white border border-[#E2E8F0] rounded-xl shadow-md px-3 py-2 flex items-center gap-1.5">
        <TrendingUp size={14} className="text-[#10B981]" />
        <span className="text-[11px] font-bold text-[#10B981]">+٢٤٪</span>
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

      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(226,232,240,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(226,232,240,0.5) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Blue radial glow — top-start corner */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineStart: "-10%",
          top: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Soft accent glow — bottom-end corner */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          insetInlineEnd: "-5%",
          bottom: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="container-app relative z-10">

        {/* ── Section header ── */}
        <div className="text-center mb-16 lg:mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#DBEAFE] bg-[#DBEAFE]/70 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span className="text-[#3B82F6] text-xs font-semibold tracking-wide uppercase">
              {w.eyebrow}
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#0F172A] leading-tight mb-5">
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

        {/* ── Two-column: mockup + features ── */}
        {/* We use LTR here so mockup stays visually on the left regardless of site language */}
        <div
          className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16"
          dir="ltr"
        >

          {/* ── Left: Dashboard mockup ── */}
          <div className="flex justify-center lg:justify-start">
            <div className="relative w-full max-w-[440px] py-10 px-6">
              <DashboardMockup />
            </div>
          </div>

          {/* ── Right: Feature cards grid ── */}
          <div dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="grid sm:grid-cols-2 gap-4">
              {w.benefits.map((benefit, i) => {
                const isHighlighted = i === 1; // highlight "إدارة ذكية" as featured
                return (
                  <div
                    key={benefit.title}
                    className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-default ${
                      isHighlighted
                        ? "border-[#3B82F6]/40 bg-white shadow-lg shadow-blue-100/60 hover:shadow-xl hover:shadow-blue-100"
                        : "border-[#E2E8F0] bg-white hover:border-[#3B82F6]/40 hover:shadow-md hover:shadow-slate-100"
                    } hover:-translate-y-1`}
                  >
                    {/* Subtle top accent line on highlighted */}
                    {isHighlighted && (
                      <div
                        className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl"
                        style={{ background: "linear-gradient(90deg, #3B82F6, #6366F1)" }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                        isHighlighted
                          ? "bg-[#3B82F6] text-white"
                          : "bg-[#DBEAFE] text-[#3B82F6] group-hover:bg-[#3B82F6] group-hover:text-white"
                      }`}
                    >
                      {ICON_MAP[benefit.icon] ?? <span className="text-lg">{benefit.icon}</span>}
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] mb-1.5 leading-snug">
                      {benefit.title}
                    </h3>
                    <p className="text-xs text-[#475569] leading-relaxed">
                      {benefit.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Inline CTA inside feature column */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/signup?type=business"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
                style={{ background: "#3B82F6" }}
              >
                {w.cta1}
              </Link>
              <Link
                href="/for-business"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border border-[#E2E8F0] text-[#475569] hover:border-[#3B82F6] hover:text-[#3B82F6] hover:bg-[#DBEAFE] transition-all"
              >
                {w.cta2}
              </Link>
            </div>
          </div>
        </div>

        {/* ── Bottom "quick bullets" trust bar ── */}
        <div className="border-t border-[#E2E8F0] pt-10">
          <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
            {w.bullets.map((bullet) => (
              <div key={bullet} className="flex items-center gap-2.5 text-sm text-[#475569]">
                <span className="w-5 h-5 rounded-full bg-[#DBEAFE] flex items-center justify-center shrink-0">
                  <Check size={11} className="text-[#3B82F6]" strokeWidth={2.5} />
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
