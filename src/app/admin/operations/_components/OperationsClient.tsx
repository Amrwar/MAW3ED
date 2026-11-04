"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Field, INPUT, StatusChip, api, cairoToday, useLoad, useSay } from "@/components/dashboard/kit";
import { formatCents } from "@/lib/payments/money";
import { localeFor, num } from "@/lib/fmt";
import type { Lang } from "@/lib/i18n";

interface Ops {
  health: {
    status: "ok" | "degraded" | "down";
    db: { ok: boolean; ms: number };
    jobs: Record<string, { lastOkAt: string | null; late: boolean }>;
    queues: Record<string, number>;
  };
  runs: { id: string; job: string; startedAt: string; finishedAt: string | null; ok: boolean | null; error: string | null }[];
  slaMinutes: Record<string, number>;
  flags: { flag: string; on: boolean }[];
}
interface Reconciliation {
  from: string;
  to: string;
  scanned: number;
  truncated: boolean;
  totals: { provider: string; kind: string; count: number; grossCents: number; refundedCents: number; netCents: number }[];
  discrepancies: { paymentId: string; check: string; detail: string }[];
}

const JOB: Record<string, [string, string]> = {
  reminders: ["التذكيرات", "Reminders"],
  notifications: ["الإشعارات", "Notifications"],
  subscriptions: ["الاشتراكات", "Subscriptions"],
  operations: ["مهام التشغيل", "Operations"],
  access: ["دخول الزوار", "Visitor access"],
  integrations: ["الربط (webhooks)", "Integrations (webhooks)"],
};
const QUEUE: [key: string, ar: string, en: string][] = [
  ["notificationsDead24h", "إشعارات اتسابت (24 ساعة)", "Notifications dead (24h)"],
  ["notificationsRetrying", "إشعارات بتتعاد", "Notifications retrying"],
  ["accessJobsPending", "مهام دخول مستنية", "Access jobs pending"],
  ["accessJobsDead24h", "مهام دخول اتسابت (24 ساعة)", "Access jobs dead (24h)"],
  ["webhooksRetrying", "Webhooks بتتعاد", "Webhooks retrying"],
  ["webhooksDead24h", "Webhooks اتسابت (24 ساعة)", "Webhooks dead (24h)"],
  ["webhookEndpointsDisabled", "عناوين webhooks وقفت لوحدها", "Webhook endpoints auto-disabled"],
  ["paymentsPendingOver1h", "مدفوعات معلّقة أكتر من ساعة", "Payments pending over 1h"],
];
const FLAG: Record<string, [string, string]> = {
  enterpriseApi: ["API الشركات", "Enterprise API"],
  webhooks: ["Webhooks", "Webhooks"],
  automations: ["الأتمتة", "Automations"],
  waitlist: ["قائمة الانتظار", "Waitlist"],
};

function at(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: "Africa/Cairo",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** A YYYY-MM-DD day moved by n days. */
function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Loading() {
  const { say } = useSay();
  return (
    <p className="m-0 text-sm text-[var(--color-subtle)]" role="status">
      <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
      {say("بيحمّل…", "Loading…")}
    </p>
  );
}

export default function OperationsClient({ canReconcile }: { canReconcile: boolean }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<Ops>("/api/admin/operations");

  return (
    <div className="space-y-6" dir={lang === "en" ? "ltr" : "rtl"}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">{say("التشغيل", "Operations")}</h1>
          <p className="m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">
            {say("صحة المنصة، المهام المجدولة، الطوابير، والمدفوعات — أرقام وحالات بس.", "Platform health, scheduled jobs, queues and payments — counts and states only.")}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={reload} disabled={loading}>
          {say("حدّث", "Refresh")}
        </button>
      </header>

      {loading && !data && <Loading />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && <OpsBody data={data} lang={lang} />}
      {canReconcile && <ReconciliationSection />}
    </div>
  );
}

function OpsBody({ data, lang }: { data: Ops; lang: Lang }) {
  const { say } = useSay();
  const { health } = data;
  const jobs = Array.from(new Set([...Object.keys(data.slaMinutes), ...Object.keys(health.jobs)]));
  const nm = (m: Record<string, [string, string]>, k: string) => (m[k] ? say(m[k][0], m[k][1]) : k);

  return (
    <>
      <Alert tone={health.status === "ok" ? "success" : health.status === "degraded" ? "warning" : "danger"}>
        <span className="font-bold">
          {health.status === "ok"
            ? say("كل حاجة شغّالة.", "All systems normal.")
            : health.status === "degraded"
              ? say("فيه حاجة محتاجة نظرة — شوف المهام المتأخرة والطوابير تحت.", "Degraded — check late jobs and queues below.")
              : say("قاعدة البيانات مش بترد.", "Down — the database is not answering.")}
        </span>{" "}
        {health.db.ok && say(`(قاعدة البيانات ردّت في ${health.db.ms} مللي ثانية)`, `(database answered in ${health.db.ms} ms)`)}
      </Alert>

      <section aria-labelledby="op-jobs" className="space-y-2">
        <h2 id="op-jobs" className="m-0 text-base font-extrabold">{say("المهام المجدولة", "Scheduled jobs")}</h2>
        <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-labelledby="op-jobs">
          <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="text-xs text-[var(--color-subtle)]">
                <th scope="col" className="p-3 text-start">{say("المهمة", "Job")}</th>
                <th scope="col" className="p-3 text-start">{say("آخر نجاح", "Last success")}</th>
                <th scope="col" className="p-3 text-start">{say("المسموح", "SLA")}</th>
                <th scope="col" className="p-3 text-start">{say("الحالة", "State")}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const r = health.jobs[j];
                const sla = data.slaMinutes[j];
                return (
                  <tr key={j} className="border-t border-[var(--color-line)]">
                    <td className="p-3">
                      {nm(JOB, j)} <span className="font-mono text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr">{j}</span>
                    </td>
                    <td className="p-3">{at(r?.lastOkAt, lang)}</td>
                    <td className="p-3">{sla ? say(`${sla} دقيقة`, `${sla} min`) : "—"}</td>
                    <td className="p-3">
                      {r?.late ? (
                        <StatusChip tone="danger">{say("متأخرة", "Late")}</StatusChip>
                      ) : r?.lastOkAt ? (
                        <StatusChip tone="jade">{say("في ميعادها", "On time")}</StatusChip>
                      ) : (
                        <StatusChip tone="muted">{say("لسه ما اشتغلتش", "Not run yet")}</StatusChip>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="op-q" className="space-y-2">
        <h2 id="op-q" className="m-0 text-base font-extrabold">{say("الطوابير", "Queues")}</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
          {QUEUE.map(([k, ar, en]) => {
            const n = health.queues[k] ?? 0;
            return (
              <li key={k} className="card p-4">
                <p className="m-0 text-[0.6875rem] text-[var(--color-subtle)]">{say(ar, en)}</p>
                <p className={`num m-0 mt-1 text-[1.375rem] font-bold leading-none ${n > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-ink)]"}`}>
                  {num(n, lang)}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="op-runs" className="space-y-2">
        <h2 id="op-runs" className="m-0 text-base font-extrabold">{say("آخر التشغيلات", "Recent runs")}</h2>
        {data.runs.length === 0 ? (
          <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش تشغيلات.", "No runs yet.")}</p>
        ) : (
          <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-labelledby="op-runs">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-xs text-[var(--color-subtle)]">
                  <th scope="col" className="p-3 text-start">{say("المهمة", "Job")}</th>
                  <th scope="col" className="p-3 text-start">{say("بدأت", "Started")}</th>
                  <th scope="col" className="p-3 text-start">{say("خلصت", "Finished")}</th>
                  <th scope="col" className="p-3 text-start">{say("النتيجة", "Result")}</th>
                  <th scope="col" className="p-3 text-start">{say("الخطأ", "Error")}</th>
                </tr>
              </thead>
              <tbody>
                {data.runs.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--color-line)] align-top">
                    <td className="p-3">{nm(JOB, r.job)}</td>
                    <td className="whitespace-nowrap p-3 text-xs">{at(r.startedAt, lang)}</td>
                    <td className="whitespace-nowrap p-3 text-xs">{at(r.finishedAt, lang)}</td>
                    <td className="p-3">
                      {r.ok === true ? (
                        <StatusChip tone="jade">{say("نجحت", "OK")}</StatusChip>
                      ) : r.ok === false ? (
                        <StatusChip tone="danger">{say("فشلت", "Failed")}</StatusChip>
                      ) : (
                        <StatusChip tone="info">{say("شغّالة", "Running")}</StatusChip>
                      )}
                    </td>
                    <td className="max-w-[20rem] break-words p-3 text-xs">{r.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="op-flags" className="space-y-2">
        <h2 id="op-flags" className="m-0 text-base font-extrabold">{say("مفاتيح الخصائص", "Feature flags")}</h2>
        <p className="m-0 text-xs text-[var(--color-subtle)]">
          {say("للعرض بس. الخاصية بتتقفل من متغيّر البيئة", "Read-only. A flag is switched off with the environment variable")}{" "}
          <code dir="ltr" className="font-mono">FEATURE_FLAGS_OFF</code>{" "}
          {say("(أسماء مفصولة بفاصلة) وبعدين إعادة نشر.", "(comma-separated names), then a redeploy.")}
        </p>
        <ul className="card m-0 list-none divide-y divide-[var(--color-line)] p-0">
          {data.flags.map((f) => (
            <li key={f.flag} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span>
                {nm(FLAG, f.flag)} <span className="font-mono text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr">{f.flag}</span>
              </span>
              {f.on ? <StatusChip tone="jade">{say("شغّالة", "On")}</StatusChip> : <StatusChip tone="muted">{say("مقفولة", "Off")}</StatusChip>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/**
 * Totals per provider and kind over a date range, and every payment whose
 * ledger does not add up. The dates picked are whole Cairo-calendar days,
 * both included; the API's `to` is exclusive, so it gets the day after.
 */
function ReconciliationSection() {
  const { lang, say } = useSay();
  const today = cairoToday();
  const [from, setFrom] = useState(() => shiftDay(today, -30));
  const [to, setTo] = useState(today);
  const [query, setQuery] = useState(() => ({ from: shiftDay(today, -30), to: shiftDay(today, 1) }));
  const url = `/api/admin/payments/reconciliation?from=${query.from}&to=${query.to}`;
  const [result, setResult] = useState<{ url: string; status: number; data: Reconciliation | null; error: string | null } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void api<Reconciliation>(url).then((r) => {
      if (!live) return;
      setResult({
        url,
        status: r.status,
        data: r.ok ? r.data : null,
        error: r.ok ? null : (r.data.error ?? say("حصلت مشكلة", "Something went wrong")),
      });
    });
    return () => {
      live = false;
    };
  }, [url, say]);

  // The route answers 404 to anyone without payments.read.
  if (result?.status === 404) return null;
  const loading = result?.url !== url;
  const data = loading ? null : (result?.data ?? null);
  const error = loading ? null : (result?.error ?? null);

  const money = (c: number) => formatCents(c, "EGP", lang);

  return (
    <section aria-labelledby="op-rec" className="space-y-3">
      <h2 id="op-rec" className="m-0 text-base font-extrabold">{say("مطابقة المدفوعات", "Payment reconciliation")}</h2>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!from || !to || to < from) {
            setFormError(say("اختار فترة صحيحة", "Pick a valid range"));
            return;
          }
          setFormError(null);
          setQuery({ from, to: shiftDay(to, 1) });
        }}
      >
        <div className="w-44">
          <Field label={say("من", "From")} htmlFor="rec-from">
            <input id="rec-from" type="date" className={INPUT} value={from} max={to} onChange={(e) => setFrom(e.target.value)} required dir="ltr" />
          </Field>
        </div>
        <div className="w-44">
          <Field label={say("لحد (شامل)", "To (inclusive)")} htmlFor="rec-to">
            <input id="rec-to" type="date" className={INPUT} value={to} min={from} onChange={(e) => setTo(e.target.value)} required dir="ltr" />
          </Field>
        </div>
        <button type="submit" className="btn btn-outline btn-sm" disabled={loading}>
          {say("طابق", "Reconcile")}
        </button>
        <p className="m-0 w-full text-xs text-[var(--color-subtle)]">{say("أقصى فترة 92 يوم.", "At most 92 days.")}</p>
      </form>
      {formError && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{formError}</p>}
      {loading && <Loading />}
      {error && <Alert tone="danger">{error}</Alert>}
      {data && (
        <>
          <p className="m-0 text-sm text-[var(--color-subtle)]">
            {say(`اتراجعت ${num(data.scanned, lang)} عملية.`, `${num(data.scanned, lang)} payments scanned.`)}
            {data.truncated && (
              <span className="font-bold text-[var(--color-warn)]">
                {" "}
                {say("النتيجة مقطوعة — صغّر الفترة عشان تشوف كل حاجة.", "Results were truncated — narrow the range to see everything.")}
              </span>
            )}
          </p>
          {data.totals.length === 0 ? (
            <p className="m-0 text-sm text-[var(--color-subtle)]">{say("مفيش مدفوعات في الفترة دي.", "No payments in this range.")}</p>
          ) : (
            <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-label={say("الإجماليات", "Totals")}>
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">{say("الإجماليات حسب المزوّد والنوع", "Totals by provider and kind")}</caption>
                <thead>
                  <tr className="text-xs text-[var(--color-subtle)]">
                    <th scope="col" className="p-3 text-start">{say("المزوّد", "Provider")}</th>
                    <th scope="col" className="p-3 text-start">{say("النوع", "Kind")}</th>
                    <th scope="col" className="p-3 text-start">{say("العدد", "Count")}</th>
                    <th scope="col" className="p-3 text-start">{say("الإجمالي", "Gross")}</th>
                    <th scope="col" className="p-3 text-start">{say("المُسترجَع", "Refunded")}</th>
                    <th scope="col" className="p-3 text-start">{say("الصافي", "Net")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.totals.map((t) => (
                    <tr key={`${t.provider}:${t.kind}`} className="border-t border-[var(--color-line)]">
                      <td className="p-3 font-mono text-xs" dir="ltr">{t.provider}</td>
                      <td className="p-3 font-mono text-xs" dir="ltr">{t.kind}</td>
                      <td className="num p-3">{num(t.count, lang)}</td>
                      <td className="num whitespace-nowrap p-3">{money(t.grossCents)}</td>
                      <td className="num whitespace-nowrap p-3">{money(t.refundedCents)}</td>
                      <td className="num whitespace-nowrap p-3 font-bold">{money(t.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 className="m-0 text-sm font-bold">{say("اختلافات", "Discrepancies")}</h3>
          {data.discrepancies.length === 0 ? (
            <Alert tone="success">{say("كل العمليات متطابقة.", "Every payment adds up.")}</Alert>
          ) : (
            <div className="card overflow-x-auto p-0" role="region" tabIndex={0} aria-label={say("اختلافات", "Discrepancies")}>
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="text-xs text-[var(--color-subtle)]">
                    <th scope="col" className="p-3 text-start">{say("العملية", "Payment")}</th>
                    <th scope="col" className="p-3 text-start">{say("الفحص", "Check")}</th>
                    <th scope="col" className="p-3 text-start">{say("التفاصيل", "Detail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.discrepancies.map((d, i) => (
                    <tr key={`${d.paymentId}:${d.check}:${i}`} className="border-t border-[var(--color-line)] align-top">
                      <td className="p-3 font-mono text-xs" dir="ltr">{d.paymentId}</td>
                      <td className="p-3 font-mono text-xs" dir="ltr">{d.check}</td>
                      <td className="break-words p-3 text-xs">{d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
