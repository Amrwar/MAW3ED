"use client";

import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Check } from "lucide-react";

/**
 * The pitch to business owners, as a light band between the home
 * page's sections (design option 3, chosen 2026-11-06).
 *
 * It replaced two things: a dark band here, and a green card that
 * floated over the footer's top edge on every other page. Mint, in the
 * hero's own tints, so the page keeps one palette from top to bottom;
 * FinalCTA below stays the one dark close.
 *
 * Kept short: the homepage is for people booking, and the full pitch,
 * benefit by benefit, is on /for-business behind the second button.
 */
export default function WhyJoin() {
  const { t, lang } = useLanguage();
  const w = t.whyJoin;
  const ar = lang === "ar";

  /**
   * What a day looks like in the dashboard. An illustration, marked as
   * one for screen readers: the names are examples, not customers.
   */
  const preview = [
    { name: ar ? "منى عادل" : "Mona Adel",     what: ar ? "10:00 · قص شعر" : "10:00 · Haircut",    ok: true },
    { name: ar ? "كريم سمير" : "Karim Samir",  what: ar ? "11:30 · ذقن" : "11:30 · Beard trim",    ok: true },
    { name: ar ? "نور هاني" : "Nour Hany",     what: ar ? "1:00 · صبغة" : "13:00 · Color",         ok: false },
  ];

  return (
    <section className="bg-[var(--color-ground)] pt-20">
      <div className="container-app">
        <div className="grid items-center gap-12 rounded-[var(--radius-2xl)] border border-[var(--color-jade-line)] bg-[var(--color-jade-tint)] px-7 py-12 sm:px-12 sm:py-14 lg:grid-cols-2 lg:gap-14">

          <div className="min-w-0">
            <span className="section-eyebrow text-[var(--color-jade)]">{w.eyebrow}</span>
            <h2 className="mt-3 text-[clamp(1.875rem,3.6vw,2.375rem)] font-light leading-[1.2] tracking-tight text-[var(--color-ink)]">
              {w.title}
              <br />
              {w.titleLine2}
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-[1.8] text-[var(--color-muted)]">
              {w.subtitle}
            </p>

            <ul className="mt-7 flex flex-col gap-3">
              {w.bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-[var(--color-ink-2)]">
                  <Check size={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup?type=business" className="btn btn-pill btn-primary font-extrabold">
                {w.cta1}
              </Link>
              <Link href="/for-business" className="btn btn-pill border-[var(--color-jade-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-jade-soft)]">
                {w.cta2}
              </Link>
            </div>
          </div>

          <div
            role="img"
            aria-label={ar ? "مثال لحجوزات اليوم في لوحة التحكم" : "Example of today's bookings in the dashboard"}
            className="min-w-0 rounded-[var(--radius-xl)] bg-[var(--color-surface)] px-6 py-5 shadow-[0_18px_40px_rgb(17_32_28/0.08)]"
          >
            <div aria-hidden="true">
              <div className="flex items-center justify-between pb-3.5">
                <span className="text-base font-bold text-[var(--color-ink)]">{ar ? "النهارده" : "Today"}</span>
                <span className="text-[0.8125rem] text-[var(--color-muted)]">{ar ? "3 حجوزات" : "3 bookings"}</span>
              </div>
              {preview.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4 border-t border-[var(--color-line)] py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-[0.9375rem] font-semibold text-[var(--color-ink)]">{p.name}</div>
                    <div className="text-[0.8125rem] text-[var(--color-muted)]" style={{ unicodeBidi: "plaintext" }}>{p.what}</div>
                  </div>
                  <span
                    className={
                      p.ok
                        ? "shrink-0 rounded-full bg-[var(--color-jade-soft)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--color-jade-hover)]"
                        : "shrink-0 rounded-full bg-[var(--color-warn-soft)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--color-warn)]"
                    }
                  >
                    {p.ok ? (ar ? "مؤكد" : "Confirmed") : (ar ? "مستني تأكيد" : "Pending")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
