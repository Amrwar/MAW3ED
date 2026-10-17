"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link2, CalendarCheck, BellRing, BarChart3, Store, Gift, Check } from "lucide-react";

/** Icons in the same order as `t.whyJoin.benefits`. */
const BENEFIT_ICONS = [Link2, CalendarCheck, BellRing, BarChart3, Store, Gift];

/**
 * The one dark band on the homepage. It marks the switch from
 * speaking to customers to speaking to business owners, so the
 * contrast is carrying the change of audience.
 */
export default function WhyJoin() {
  const { t, lang } = useLanguage();
  const w = t.whyJoin;

  /**
   * Facts about the product, not claimed outcomes.
   *
   * Two of these used to be "38% more bookings in 3 months" and "61%
   * fewer no-shows" — figures nothing measures and nothing could back
   * up. What the free plan costs and what onboarding takes are things
   * the product actually decides, so they stayed.
   */
  const stats = [
    { value: lang === "ar" ? "0 ج.م" : "Free", ar: "للخطة المجانية، للأبد", en: "plan, forever" },
    { value: lang === "ar" ? "0%"   : "0%",    ar: "عمولة على كل حجز",      en: "commission per booking" },
    { value: lang === "ar" ? "5 دقايق" : "5 min", ar: "وقت تجهيز صفحتك",    en: "to set your page up" },
    { value: lang === "ar" ? "24 ساعة" : "24 h", ar: "أقصى وقت لرد الدعم بالعربي", en: "for support to reply, in Arabic" },
  ];

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">
        <div className="rounded-[var(--radius-2xl)] bg-[var(--color-night)] px-8 py-14 sm:px-12 sm:py-16">

          <div className="flex flex-wrap items-center gap-12">

            <div className="flex-[1_1_26rem] min-w-0">
              <span className="section-eyebrow text-[var(--color-night-subtle)]">{w.eyebrow}</span>
              <h2 className="mt-3 text-[clamp(1.875rem,3.6vw,2.375rem)] font-light leading-[1.2] tracking-tight text-[var(--color-inverse)]">
                {w.title}
                <br />
                {w.titleLine2}
              </h2>
              <p className="mt-4 max-w-[46ch] text-base leading-[1.8] text-[var(--color-night-text)]">
                {w.subtitle}
              </p>

              <ul className="mt-7 flex flex-col gap-3">
                {w.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-[0.90625rem] leading-relaxed text-[var(--color-night-text)]">
                    <Check size={17} strokeWidth={2.4} className="mt-1 shrink-0 text-[var(--color-night-accent)]" aria-hidden="true" />
                    {b}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup?type=business" className="btn btn-pill bg-white text-[var(--color-ink)] font-extrabold hover:bg-white/90">
                  {w.cta1}
                </Link>
                <Link href="/for-business" className="btn btn-pill border-[var(--color-night-line)] bg-transparent text-[var(--color-inverse)] hover:bg-white/10">
                  {w.cta2}
                </Link>
              </div>
            </div>

            <div className="grid flex-[0_1_22rem] min-w-[16rem] grid-cols-2 gap-3.5">
              {stats.map((s) => (
                <div key={s.en} className="rounded-[var(--radius-lg)] bg-[var(--color-night-2)] p-5">
                  <div className="text-[1.75rem] font-extrabold leading-tight text-[var(--color-inverse)]" style={{ unicodeBidi: "plaintext" }}>{s.value}</div>
                  <div className="mt-1.5 text-xs leading-snug text-[var(--color-night-subtle)]">
                    {lang === "ar" ? s.ar : s.en}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-x-10 gap-y-9 border-t border-[var(--color-night-line)] pt-12 sm:grid-cols-2 lg:grid-cols-3">
            {w.benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? Store;
              return (
                <div key={b.title} className="min-w-0">
                  <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-night-line)]">
                    <Icon size={19} strokeWidth={1.7} className="text-[#4FA98B]" aria-hidden="true" />
                  </span>
                  <h3 className="text-[1.0625rem] font-bold text-[var(--color-inverse)]">{b.title}</h3>
                  <p className="mt-2 text-[0.875rem] leading-[1.8] text-[var(--color-night-text)]">
                    {b.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
