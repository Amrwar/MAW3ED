"use client";

import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, Check, Clock, Languages, LayoutDashboard, RefreshCw } from "lucide-react";
import { clock12 } from "@/lib/fmt";

const BULLET_ICONS = [Clock, Check, Languages, RefreshCw];

/**
 * The pitch to business owners (design B4, chosen 2026-11-06): the copy
 * on the page's ground, and a soft-green panel that runs off the edge of
 * the screen holding a sample of the dashboard.
 *
 * It sits between the stone "why Maw3ed" band and the white FAQ band, so
 * neither neighbour shares its background. FinalCTA below stays the one
 * dark close. The full pitch is on /for-business behind the second button.
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
    { name: ar ? "منى عادل" : "Mona Adel",    time: "10:00", what: ar ? "قص شعر" : "Haircut",    ok: true },
    { name: ar ? "كريم سمير" : "Karim Samir", time: "11:30", what: ar ? "ذقن" : "Beard trim",      ok: true },
    { name: ar ? "نور هاني" : "Nour Hany",    time: "13:00", what: ar ? "صبغة" : "Color",           ok: false },
  ];

  return (
    <section className="overflow-x-clip bg-[var(--color-ground)] py-20">
      <div className="container-app">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

          <div className="min-w-0">
            <span className="section-eyebrow text-[var(--color-jade)]">{w.eyebrow}</span>
            <h2 className="section-title mt-2.5">
              {w.title}
              <br />
              {w.titleLine2}
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-[1.8] text-[var(--color-muted)]">
              {w.subtitle}
            </p>

            <ul className="mt-7 flex flex-col gap-3.5">
              {w.bullets.map((b, i) => {
                const Icon = BULLET_ICONS[i] ?? Check;
                return (
                  <li key={b} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-[var(--color-ink-2)]">
                    <Icon size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--color-jade)]" aria-hidden="true" />
                    {b}
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup?type=business" className="btn btn-pill btn-primary font-extrabold">
                {w.cta1}
              </Link>
              <Link href="/for-business" className="btn btn-pill btn-outline bg-[var(--color-surface)]">
                {w.cta2}
              </Link>
            </div>
          </div>

          {/* The panel's colour runs on past the container to the edge of
              the screen on wide layouts; the section clips the overflow. */}
          <div className="relative min-w-0 rounded-[var(--radius-2xl)] bg-[var(--color-jade-soft)] px-5 py-8 sm:px-10 sm:py-10 lg:rounded-none lg:bg-transparent lg:px-0 lg:py-14 lg:ps-12">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 -end-[50vw] start-0 -z-0 hidden rounded-s-[2rem] bg-[var(--color-jade-soft)] lg:block"
            />
            <div
              role="img"
              aria-label={ar ? "مثال لحجوزات اليوم في لوحة التحكم" : "Example of today's bookings in the dashboard"}
              className="relative"
            >
              <div aria-hidden="true">
                <p className="m-0 mb-6 flex items-center gap-2 text-[0.875rem] font-bold text-[var(--color-jade-hover)]">
                  <LayoutDashboard size={16} strokeWidth={1.9} />
                  {ar ? "لوحة التحكم بتاعتك" : "Your dashboard"}
                </p>

                <div className="max-w-[28rem] rounded-[var(--radius-xl)] bg-[var(--color-surface)] px-6 py-5 shadow-[0_18px_40px_rgb(17_32_28/0.08)]">
                  <div className="flex items-center justify-between gap-3 pb-3.5">
                    <span className="text-base font-bold text-[var(--color-ink)]">{ar ? "النهارده" : "Today"}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[0.8125rem] text-[var(--color-muted)]">{ar ? "3 حجوزات" : "3 bookings"}</span>
                      <span className="rounded-full bg-[var(--color-surface-3)] px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--color-subtle)]">
                        {ar ? "مثال" : "Sample"}
                      </span>
                    </span>
                  </div>
                  {preview.map((p) => (
                    <div key={p.name} className="flex items-center justify-between gap-4 border-t border-[var(--color-line)] py-3.5">
                      <div className="min-w-0">
                        <div className="truncate text-[0.9375rem] font-semibold text-[var(--color-ink)]">{p.name}</div>
                        <div className="text-[0.8125rem] text-[var(--color-muted)]">
                          {clock12(p.time, lang)} · {p.what}
                        </div>
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

                <div className="mt-4 flex max-w-[22rem] items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[0_12px_30px_rgb(17_32_28/0.07)] sm:ms-24">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-warn-soft)] text-[var(--color-warn)]">
                    <Bell size={17} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-bold text-[var(--color-ink)]">
                      {ar ? "التذكير اتبعت لوحده" : "Reminder sent automatically"}
                    </span>
                    <span className="block text-[0.8125rem] text-[var(--color-subtle)]">
                      {ar ? "قبل كل ميعاد" : "Before each appointment"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
