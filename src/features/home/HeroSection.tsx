"use client";

import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Check, Clock, ArrowLeft, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Booking widget mockup ────────────────────────────────

function BookingMockup() {
  return (
    <div className="relative flex justify-center lg:justify-end" dir="rtl">

      {/* Confirmation toast */}
      <div
        className="absolute -top-5 lg:-top-7 right-2 lg:-right-8 z-20 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
        style={{ minWidth: 210 }}
      >
        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
          <Check size={16} className="text-green-600" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs font-bold text-[#0F172A]">تم تأكيد الحجز!</p>
          <p className="text-xs text-[#94A3B8]">الأحد، ٦ أبريل · ١١:٠٠ ص</p>
        </div>
      </div>

      {/* Main widget */}
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-[360px] relative z-10">

        {/* Header gradient */}
        <div
          className="px-5 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)" }}
        >
          <div>
            <h3 className="text-white text-lg font-bold leading-tight">احجز موعدك</h3>
            <p className="text-blue-300 text-sm mt-0.5">عيادة د. أحمد السيد</p>
          </div>
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center overflow-hidden">
            <Image src="/apple-touch-icon.png" alt="موعد" width={40} height={40} className="rounded-xl object-cover" />
          </div>
        </div>

        {/* Stepper */}
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-start justify-between relative">
            <div className="absolute top-4 right-6 left-6 h-px bg-[#E2E8F0]" />
            {[
              { n: "١", label: "الخدمة", active: true },
              { n: "٢", label: "الموعد", active: false },
              { n: "٣", label: "تأكيد",  active: false },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    s.active
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}
                >
                  {s.n}
                </div>
                <span className={`text-[10px] font-semibold ${s.active ? "text-[#3B82F6]" : "text-[#94A3B8]"}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 bg-[#3B82F6] rounded-full" />
            <p className="text-sm font-bold text-[#0F172A]">اختر الخدمة</p>
          </div>

          {[
            { icon: "🩺", name: "كشف باطنة",  dur: "٣٠ دقيقة", price: "٢٥٠ ج", selected: true,  bg: "bg-blue-50"   },
            { icon: "❤️", name: "كشف قلبي",   dur: "٤٥ دقيقة", price: "٤٠٠ ج", selected: false, bg: "bg-purple-50" },
            { icon: "💬", name: "استشارة",    dur: "٢٠ دقيقة", price: "٨٠ ج",  selected: false, bg: "bg-green-50"  },
          ].map((svc, i) => (
            <div
              key={i}
              className={`rounded-2xl p-3 mb-2 flex items-center gap-3 relative ${
                svc.selected
                  ? "border-2 border-[#3B82F6] bg-blue-50/50"
                  : "border border-[#E2E8F0] bg-white"
              }`}
            >
              {svc.selected && (
                <span className="absolute top-2.5 left-2.5 w-5 h-5 bg-[#3B82F6] rounded-full flex items-center justify-center">
                  <Check size={11} className="text-white" strokeWidth={3} />
                </span>
              )}
              <div className={`w-11 h-11 rounded-xl ${svc.bg} flex items-center justify-center shrink-0 text-lg`}>
                {svc.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#0F172A]">{svc.name}</p>
                <p className="text-xs text-[#94A3B8] flex items-center gap-1 mt-0.5">
                  <Clock size={10} /> {svc.dur}
                </p>
              </div>
              <p className={`text-sm font-black shrink-0 ${svc.selected ? "text-[#3B82F6]" : "text-[#475569]"}`}>
                {svc.price}
              </p>
            </div>
          ))}

          <button
            className="w-full mt-2 py-3 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
            style={{ background: "#0F172A" }}
          >
            التالي <ArrowLeft size={15} />
          </button>
        </div>
      </div>

      {/* Stats badge */}
      <div className="absolute -bottom-5 left-2 lg:-bottom-7 lg:-left-8 z-20 bg-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#DBEAFE] rounded-xl flex items-center justify-center shrink-0">
          <Zap size={17} className="text-[#3B82F6]" />
        </div>
        <div>
          <p className="text-xs font-bold text-[#0F172A]">٣٢١ حجز</p>
          <p className="text-xs text-[#94A3B8]">هذا الشهر</p>
        </div>
      </div>
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────

export default function HeroSection() {
  const { t, lang } = useLanguage();
  const h = t.hero;

  const stats = [
    { value: "٣٠٠+",   label: "نشاط تجاري" },
    { value: "١٢ألف+", label: "حجز مكتمل" },
    { value: "٤.٩ ⭐", label: "متوسط التقييم" },
  ];

  return (
    <section
      className="relative min-h-screen flex items-center overflow-hidden pt-16"
      style={{ background: "#0F172A" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      {/* Dot grid */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Blue glow */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-64 -end-64 w-[700px] h-[700px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 start-0 w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}
        />
      </div>

      <div className="container-app relative z-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left / content */}
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#3B82F6]/30 bg-[#3B82F6]/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
              <span className="text-[#93C5FD] text-xs font-semibold tracking-wide">{h.eyebrow}</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.15] mb-6">
              {h.title}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #60A5FA 0%, #A78BFA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {h.titleAccent}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-[#94A3B8] text-lg leading-relaxed mb-8 max-w-lg whitespace-pre-line">
              {h.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mb-12">
              <Link
                href="/signup?type=business"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-white text-sm shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 hover:shadow-blue-500/30 transition-all"
                style={{ background: "#3B82F6" }}
              >
                ابدأ مجانًا الآن
              </Link>
              <Link
                href="/businesses"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm border border-white/15 text-white/75 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
              >
                تصفح الأعمال
                <ArrowLeft size={15} />
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-8 pt-6 border-t border-white/10">
              {stats.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-black text-white">{s.value}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right / mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-full max-w-[420px] py-12">
              <BookingMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
