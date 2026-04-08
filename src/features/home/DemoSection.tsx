"use client";

import Link from "next/link";
import { CalendarDays, Check, Clock, Zap, Bell, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function MiniBookingCard() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden w-full max-w-xs" dir="rtl">
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E40AF 100%)" }}
      >
        <div>
          <p className="text-white font-bold text-sm">عيادة د. أحمد</p>
          <p className="text-blue-300 text-xs">طب باطني · المعادي</p>
        </div>
        <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
          <CalendarDays size={16} className="text-white" />
        </div>
      </div>

      {/* Date picker strip */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-bold text-[#94A3B8] mb-3 uppercase tracking-wide">اختر اليوم</p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[
            { day: "الأحد", n: "٦", active: false, disabled: true },
            { day: "الإثنين", n: "٧", active: true,  disabled: false },
            { day: "الثلاثاء", n: "٨", active: false, disabled: false },
            { day: "الأربعاء", n: "٩", active: false, disabled: false },
          ].map((d) => (
            <div
              key={d.n}
              className={`flex flex-col items-center py-2 px-2.5 rounded-xl shrink-0 min-w-[44px] text-xs ${
                d.disabled
                  ? "bg-[#F1F5F9] text-[#CBD5E1] opacity-50"
                  : d.active
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#F8FAFC] text-[#475569]"
              }`}
            >
              <span className="text-[9px] opacity-70">{d.day.slice(0, 3)}</span>
              <span className="font-bold text-sm mt-0.5">{d.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time slots */}
      <div className="px-4 pb-4 pt-2">
        <p className="text-xs font-bold text-[#94A3B8] mb-3 uppercase tracking-wide">اختر الوقت</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["٩:٠٠", "١٠:٠٠", "١١:٠٠", "١٢:٠٠", "٢:٠٠", "٣:٠٠"].map((t, i) => (
            <div
              key={t}
              className={`py-2 text-center rounded-xl text-xs font-semibold border ${
                i === 1
                  ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                  : "border-[#E2E8F0] text-[#475569]"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
        <button
          className="w-full py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ background: "#0F172A" }}
        >
          <Check size={13} /> تأكيد الحجز
        </button>
      </div>
    </div>
  );
}

function ConfirmationCard() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[#E2E8F0] p-5 w-full max-w-xs" dir="rtl">
      <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <Check size={24} className="text-green-500" strokeWidth={2.5} />
      </div>
      <p className="text-center font-black text-[#0F172A] text-base mb-1">تم حجز موعدك! 🎉</p>
      <p className="text-center text-xs text-[#94A3B8] mb-4">سيتواصل معك الفريق قريبًا</p>
      <div className="space-y-2 bg-[#F8FAFC] rounded-xl p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#94A3B8]">الخدمة</span>
          <span className="font-semibold text-[#0F172A]">كشف باطنة</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#94A3B8]">التاريخ</span>
          <span className="font-semibold text-[#0F172A]">الإثنين، ٧ أبريل</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#94A3B8]">الوقت</span>
          <span className="font-semibold text-[#0F172A]" dir="ltr">10:00 AM</span>
        </div>
        <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-xs">
          <span className="text-[#94A3B8]">الإجمالي</span>
          <span className="font-black text-[#3B82F6]">٢٥٠ ج.م</span>
        </div>
      </div>
    </div>
  );
}

export default function DemoSection() {
  const { t, lang } = useLanguage();
  const d = t.demo;

  return (
    <section
      className="py-20 lg:py-28"
      style={{ background: "#0F172A" }}
      dir={lang === "ar" ? "rtl" : "ltr"}
    >
      <div className="container-app">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* UI cards (left/start) */}
          <div className="flex flex-col sm:flex-row lg:flex-row gap-5 items-start justify-center order-last lg:order-first">
            <MiniBookingCard />
            <div className="sm:mt-12 lg:mt-16 shrink-0">
              <ConfirmationCard />
            </div>
          </div>

          {/* Text (right/end) */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[#3B82F6]/15 text-[#93C5FD] mb-5 tracking-wide uppercase border border-[#3B82F6]/20">
              {d.eyebrow}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">
              {d.title}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, #60A5FA 0%, #A78BFA 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {d.titleLine2}
              </span>
            </h2>
            <p className="text-[#94A3B8] text-lg leading-relaxed mb-8">{d.subtitle}</p>

            <div className="space-y-4 mb-10">
              {d.features.map((f) => (
                <div key={f.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/15 flex items-center justify-center shrink-0 text-lg">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/for-business"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-[#0F172A] text-sm bg-white hover:bg-[#F8FAFC] shadow-lg transition-all"
            >
              {d.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
