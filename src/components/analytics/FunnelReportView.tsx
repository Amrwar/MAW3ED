"use client";

import type { FunnelStep, TrafficSource } from "@prisma/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";
import type { FunnelReportData } from "@/lib/analytics/funnel-report";
import { SOURCE_LABELS } from "@/lib/attribution/source";

const STEP_LABELS: Record<FunnelStep, { ar: string; en: string }> = {
  MARKETPLACE_VIEW: { ar: "شافوا قائمة الأماكن", en: "Saw the listing" },
  SEARCH: { ar: "بحثوا أو فلتروا", en: "Searched or filtered" },
  ORGANIZATION_VIEW: { ar: "فتحوا صفحة الجهة", en: "Opened the organization page" },
  BUSINESS_VIEW: { ar: "فتحوا صفحة النشاط", en: "Opened a business page" },
  SERVICE_SELECTED: { ar: "اختاروا خدمة", en: "Picked a service" },
  BOOKING_STARTED: { ar: "بدأوا الحجز", en: "Started booking" },
  TIME_SELECTED: { ar: "اختاروا ميعاد", en: "Picked a time" },
  FOR_BUSINESS_VIEW: { ar: "فتحوا صفحة «لأصحاب الأعمال»", en: "Opened “For business”" },
  PRICING_VIEW: { ar: "فتحوا الأسعار", en: "Opened pricing" },
  DEMO_VIEW: { ar: "جرّبوا النسخة التجريبية", en: "Tried the demo" },
  SIGNUP_VIEW: { ar: "فتحوا صفحة التسجيل", en: "Opened sign-up" },
};

/**
 * A funnel, read top to bottom: each reported step with its share of the
 * step before, then what the records say. Shared by the business report,
 * the organization console and the platform admin; each passes only the
 * steps its scope has.
 */
export default function FunnelReportView({
  data,
  steps,
  note,
  recorded = true,
}: {
  data: FunnelReportData;
  /** The reported steps to show, in order. */
  steps: readonly FunnelStep[];
  /** A line under the title, e.g. what an organization does not see. */
  note?: string;
  /** Show the booking-records section (not for the business sign-up funnel). */
  recorded?: boolean;
}) {
  const { lang } = useLanguage();
  const ar = lang === "ar";
  const pct = (n: number | undefined, of: number | undefined) =>
    of && of > 0 ? `${num(Math.round(Math.min(1, (n ?? 0) / of) * 100), lang)}%` : "—";
  const src = (s: TrafficSource) => (ar ? SOURCE_LABELS[s].ar : SOURCE_LABELS[s].en);

  const rows = steps.map((s, i) => {
    const n = data.steps[s] ?? 0;
    const prev = i > 0 ? data.steps[steps[i - 1]] : undefined;
    const bySource = Object.entries(data.stepsBySource[s] ?? {})
      .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
      .slice(0, 3)
      .map(([k, v]) => `${src(k as TrafficSource)} ${num(v ?? 0, lang)}`)
      .join(" · ");
    return { s, n, rate: i > 0 ? pct(n, prev) : null, bySource };
  });
  const top = Math.max(1, ...rows.map((r) => r.n));
  const lastReported = steps.length ? data.steps[steps[steps.length - 1]] : undefined;
  const p = data.recorded.payment;

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden" aria-labelledby="funnel-steps">
        <header className="border-b border-[var(--color-line)] px-5 py-3.5">
          <h2 id="funnel-steps" className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]">
            {ar ? "رحلة الزوّار" : "Visitor funnel"}
          </h2>
          <p className="m-0 mt-1 text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
            {ar
              ? "كل رقم = عدد تابات المتصفح اللي وصلت للخطوة، مرة واحدة في اليوم. مفيش أي بيانات عن الزائر نفسه."
              : "Each figure is browser tabs that reached the step, once a day. Nothing about the visitor is recorded."}
            {note ? ` ${note}` : ""}
          </p>
        </header>
        <ol className="m-0 list-none space-y-3 p-5">
          {rows.map((r) => (
            <li key={r.s}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-[0.8125rem] text-[var(--color-ink-2)]">
                  {ar ? STEP_LABELS[r.s].ar : STEP_LABELS[r.s].en}
                  {r.rate && (
                    <span className="num ms-2 text-[0.6875rem] text-[var(--color-subtle)]">
                      {ar ? `${r.rate} من اللي قبلها` : `${r.rate} of the step before`}
                    </span>
                  )}
                </span>
                <span className="num shrink-0 text-[0.8125rem] font-bold text-[var(--color-ink)]">
                  {num(r.n, lang)}
                </span>
              </div>
              <span
                aria-hidden="true"
                className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]"
              >
                <span
                  className="block h-full rounded-full bg-[var(--color-jade)]"
                  style={{ width: `${(r.n / top) * 100}%` }}
                />
              </span>
              {r.bySource && (
                <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-subtle)]">{r.bySource}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {recorded && (
        <section className="card overflow-hidden" aria-labelledby="funnel-recorded">
          <header className="border-b border-[var(--color-line)] px-5 py-3.5">
            <h2
              id="funnel-recorded"
              className="m-0 text-[0.9375rem] font-bold text-[var(--color-ink)]"
            >
              {ar ? "من سجل الحجوزات" : "From the booking records"}
            </h2>
            <p className="m-0 mt-1 text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
              {ar
                ? "دي من الحجوزات نفسها، فبتشمل حجوزات التطبيق والحجوزات اللي اتسجلت يدوي — ممكن تبقى أكتر من الخطوة اللي قبلها."
                : "These come from the bookings themselves, so they include app and front-desk bookings — they can exceed the step before."}
            </p>
          </header>
          <dl className="m-0 grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            {[
              {
                k: ar ? "حجوزات اتعملت" : "Bookings made",
                v: num(data.recorded.made, lang),
                hint: steps.length
                  ? ar
                    ? `${pct(data.recorded.made, lastReported)} من آخر خطوة`
                    : `${pct(data.recorded.made, lastReported)} of the last step`
                  : undefined,
              },
              {
                k: ar ? "اتلغت بعدها" : "Cancelled since",
                v: num(data.recorded.cancelled, lang),
                hint: pct(data.recorded.cancelled, data.recorded.made),
              },
              {
                k: ar ? "حجز متكرر" : "Repeat bookings",
                v: num(data.recorded.repeat, lang),
                hint: pct(data.recorded.repeat, data.recorded.made),
              },
              ...(p
                ? [
                    {
                      k: ar ? "دفع أونلاين: نجح / فشل" : "Online payment: paid / failed",
                      v: `${num(p.paid, lang)} / ${num(p.failed, lang)}`,
                      hint: ar
                        ? `من ${num(p.started, lang)} بدأوا الدفع`
                        : `of ${num(p.started, lang)} checkouts`,
                    },
                  ]
                : []),
            ].map((f) => (
              <div key={f.k} className="rounded-[var(--radius-md)] bg-[var(--color-surface)] p-3">
                <dt className="text-[0.6875rem] text-[var(--color-subtle)]">{f.k}</dt>
                <dd className="num m-0 mt-1 text-[1.125rem] font-bold text-[var(--color-ink)]">
                  {f.v}
                </dd>
                {f.hint && (
                  <dd className="m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">
                    {f.hint}
                  </dd>
                )}
              </div>
            ))}
          </dl>
          {Object.keys(data.madeBySource).length > 0 && (
            <p className="m-0 border-t border-[var(--color-line)] px-5 py-3 text-[0.75rem] text-[var(--color-subtle)]">
              {ar ? "الحجوزات حسب المصدر: " : "Bookings by channel: "}
              {Object.entries(data.madeBySource)
                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                .map(([k, v]) => `${src(k as TrafficSource)} ${num(v ?? 0, lang)}`)
                .join(" · ")}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
