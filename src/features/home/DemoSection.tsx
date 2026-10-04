"use client";

import Link from "next/link";
import { CalendarDays, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function MiniBookingCard() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[var(--color-line)] overflow-hidden w-full max-w-xs" dir="rtl">
      {/* Header */}
      <div
        className="px-4 py-4 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-jade-hover) 100%)" }}
      >
        <div>
          <p className="text-white font-bold text-sm">عيادة د. أحمد</p>
          <p className="text-[var(--color-jade-line)] text-xs">طب باطني · المعادي</p>
        </div>
        <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
          <CalendarDays size={16} className="text-white" />
        </div>
      </div>

      {/* Date picker strip */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-bold text-[var(--color-subtle)] mb-3 uppercase tracking-wide">اختر اليوم</p>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {[
            { day: "الأحد", n: "6", active: false, disabled: true },
            { day: "الإثنين", n: "7", active: true,  disabled: false },
            { day: "الثلاثاء", n: "8", active: false, disabled: false },
            { day: "الأربعاء", n: "9", active: false, disabled: false },
          ].map((d) => (
            <div
              key={d.n}
              className={`flex flex-col items-center py-2 px-2.5 rounded-xl shrink-0 min-w-[44px] text-xs ${
                d.disabled
                  ? "bg-[var(--color-surface-3)] text-[var(--color-line-2)] opacity-50"
                  : d.active
                  ? "bg-[var(--color-jade)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)]"
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
        <p className="text-xs font-bold text-[var(--color-subtle)] mb-3 uppercase tracking-wide">اختر الوقت</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {["9:00", "10:00", "11:00", "12:00", "2:00", "3:00"].map((t, i) => (
            <div
              key={t}
              className={`py-2 text-center rounded-xl text-xs font-semibold border ${
                i === 1
                  ? "bg-[var(--color-jade)] text-white border-[var(--color-jade)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)]"
              }`}
            >
              {t}
            </div>
          ))}
        </div>
        <button
          className="w-full py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5"
          style={{ background: "var(--color-ink)" }}
        >
          <Check size={13} /> تأكيد الحجز
        </button>
      </div>
    </div>
  );
}

function ConfirmationCard() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-[var(--color-line)] p-5 w-full max-w-xs" dir="rtl">
      <div className="w-12 h-12 bg-[var(--color-ok-soft)] rounded-full flex items-center justify-center mx-auto mb-3">
        <Check size={24} className="text-[var(--color-ok)]" strokeWidth={2.5} />
      </div>
      <p className="text-center font-extrabold text-[var(--color-ink)] text-base mb-1">تم حجز موعدك! 🎉</p>
      <p className="text-center text-xs text-[var(--color-subtle)] mb-4">سيتواصل معك الفريق قريبًا</p>
      <div className="space-y-2 bg-[var(--color-surface-2)] rounded-xl p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-subtle)]">الخدمة</span>
          <span className="font-semibold text-[var(--color-ink)]">كشف باطنة</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-subtle)]">التاريخ</span>
          <span className="font-semibold text-[var(--color-ink)]">الإثنين، 7 أبريل</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-subtle)]">الوقت</span>
          <span className="font-semibold text-[var(--color-ink)]" dir="ltr">10:00 AM</span>
        </div>
        <div className="pt-2 border-t border-[var(--color-line)] flex items-center justify-between text-xs">
          <span className="text-[var(--color-subtle)]">الإجمالي</span>
          <span className="font-extrabold text-[var(--color-jade)]">250 ج.م</span>
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
      style={{ background: "var(--color-ink)" }}
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
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-jade)]/15 text-[var(--color-jade-line)] mb-5 tracking-wide uppercase border border-[var(--color-jade)]/20">
              {d.eyebrow}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
              {d.title}{" "}
              <span
                style={{
                  background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade-line) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {d.titleLine2}
              </span>
            </h2>
            <p className="text-[var(--color-subtle)] text-lg leading-relaxed mb-8">{d.subtitle}</p>

            <div className="space-y-4 mb-10">
              {d.features.map((f) => (
                <div key={f.title} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-jade)]/15 flex items-center justify-center shrink-0 text-lg">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{f.title}</p>
                    <p className="text-xs text-[var(--color-muted)] mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/for-business"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-[var(--color-ink)] text-sm bg-white hover:bg-[var(--color-surface-2)] shadow-lg transition-all"
            >
              {d.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
