"use client";

import { useState } from "react";
import { Loader2, Plus, Power, ShoppingBag } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Tabs from "@/components/ui/Tabs";
import {
  Field, INPUT, PageHeader, ServicePicker, StatusChip, api, poundsToCents, useLoad, useSay,
} from "@/components/dashboard/kit";
import { formatCents } from "@/lib/payments/money";
import { dateShort, num } from "@/lib/fmt";
import SellForm from "./SellForm";
import SoldActions from "./SoldActions";

type Svc = { id: string; nameAr: string; nameEn: string | null };
type Say = (ar: string, en: string) => string;

interface PackagesData {
  plans: { id: string; nameAr: string; nameEn: string | null; serviceIds: string[]; sessions: number; priceCents: number; validityDays: number; isActive: boolean; _count: { purchases: number } }[];
  sold: { id: string; phoneE164: string; customerName: string; sessionsTotal: number; sessionsUsed: number; priceCents: number; status: string; expiresAt: string | null; createdAt: string; plan: { nameAr: string } }[];
}
interface MembershipsData {
  plans: { id: string; nameAr: string; nameEn: string | null; serviceIds: string[]; priceCents: number; periodDays: number; includedVisits: number; isActive: boolean; _count: { memberships: number } }[];
  members: { id: string; phoneE164: string; customerName: string; status: string; paidThrough: string | null; pausedDays: number; cancelAtPeriodEnd: boolean; includedVisits: number; priceCents: number; plan: { nameAr: string }; current: { used: number; includedVisits: number; endsAt: string } | null }[];
}

const STATUS: Record<string, { tone: "jade" | "warn" | "muted" | "danger" | "info"; ar: string; en: string }> = {
  PENDING_PAYMENT: { tone: "warn", ar: "مستني الدفع", en: "Awaiting payment" },
  ACTIVE: { tone: "jade", ar: "شغّالة", en: "Active" },
  PAUSED: { tone: "info", ar: "موقوفة مؤقتًا", en: "Paused" },
  EXHAUSTED: { tone: "muted", ar: "خلصت", en: "Used up" },
  EXPIRED: { tone: "muted", ar: "انتهت", en: "Expired" },
  CANCELLED: { tone: "danger", ar: "اتلغت", en: "Cancelled" },
  REFUNDED: { tone: "danger", ar: "اتردّت", en: "Refunded" },
};

function Status({ s, say }: { s: string; say: Say }) {
  const x = STATUS[s] ?? { tone: "muted" as const, ar: s, en: s };
  return <StatusChip tone={x.tone}>{say(x.ar, x.en)}</StatusChip>;
}

export default function PackagesClient({ services }: { services: Svc[] }) {
  const { say } = useSay();
  const [tab, setTab] = useState<"packages" | "memberships">("packages");

  return (
    <div className="space-y-5">
      <PageHeader
        title={say("الباقات والعضويات", "Packages & memberships")}
        sub={say(
          "الباقة جلسات بتتباع مقدّمًا (مثلًا 5 قصّات). العضوية اشتراك كل فترة فيه عدد زيارات. البيع هنا بيتسجّل كدفع في المكان، ورقم الموبايل هو اللي بيربط الرصيد بحجوزات العميل.",
          "A package is sessions sold ahead (say, 5 haircuts). A membership is a fee per period with included visits. Sales here are recorded as paid in person; the mobile number links the balance to the customer's bookings.",
        )}
      />
      <Tabs
        label={say("النوع", "Kind")}
        value={tab}
        onChange={setTab}
        items={[
          { value: "packages", label: say("الباقات", "Packages") },
          { value: "memberships", label: say("العضويات", "Memberships") },
        ]}
      />
      {tab === "packages" ? <PackagesTab services={services} /> : <MembershipsTab services={services} />}
    </div>
  );
}

function serviceSummary(ids: string[], services: Svc[], say: Say, lang: string) {
  if (ids.length === 0) return say("أي خدمة", "Any service");
  return ids
    .map((id) => services.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => (lang === "en" && s!.nameEn ? s!.nameEn : s!.nameAr))
    .join("، ");
}

async function togglePlan(path: string, isActive: boolean) {
  return api(path, "PATCH", { isActive });
}

// ─── Packages ────────────────────────────────────────────────────────────────

function PackagesTab({ services }: { services: Svc[] }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<PackagesData>("/api/business/packages");
  const [creating, setCreating] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggle(id: string, isActive: boolean) {
    setBusy(id);
    setActionError(null);
    const r = await togglePlan(`/api/business/packages/${id}`, isActive);
    setBusy(null);
    if (!r.ok) setActionError(r.data.error ?? say("تعذّر التغيير", "Could not change"));
    else reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreating((v) => !v)} className="btn btn-primary btn-sm" aria-expanded={creating}>
          <Plus size={14} aria-hidden="true" />
          {say("باقة جديدة", "New package")}
        </button>
      </div>
      {creating && (
        <PlanForm kind="package" services={services} onDone={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />
      )}

      {loading && <Loading say={say} />}
      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {data && (
        <>
          <section aria-labelledby="pk-plans" className="space-y-2">
            <h2 id="pk-plans" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("الباقات المعروضة", "Package plans")}</h2>
            {data.plans.length === 0 ? (
              <Empty text={say("لسه مفيش باقات.", "No packages yet.")} />
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {data.plans.map((p) => (
                  <li key={p.id} className="card space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 font-bold text-[var(--color-ink)]">
                          {lang === "en" && p.nameEn ? p.nameEn : p.nameAr}
                          {!p.isActive && <span className="ms-2 text-[0.6875rem] font-normal text-[var(--color-subtle)]">{say("موقوفة", "Off")}</span>}
                        </p>
                        <p className="num m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                          {say(`${p.sessions} جلسة`, `${p.sessions} sessions`)} · {formatCents(p.priceCents, "EGP", lang)} · {say(`صالحة ${p.validityDays} يوم`, `valid ${p.validityDays} days`)} · {serviceSummary(p.serviceIds, services, say, lang)}
                        </p>
                        <p className="num m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">
                          {say(`اتباعت ${p._count.purchases} مرة`, `Sold ${p._count.purchases} times`)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {p.isActive && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelling(selling === p.id ? null : p.id)} aria-expanded={selling === p.id}>
                            <ShoppingBag size={12} aria-hidden="true" />
                            {say("بيع", "Sell")}
                          </button>
                        )}
                        <button type="button" className="btn btn-outline btn-sm" disabled={busy === p.id} onClick={() => void toggle(p.id, !p.isActive)}>
                          <Power size={12} aria-hidden="true" />
                          {p.isActive ? say("وقّف", "Turn off") : say("شغّل", "Turn on")}
                        </button>
                      </div>
                    </div>
                    {selling === p.id && (
                      <SellForm kind="package" planId={p.id} planName={p.nameAr} onDone={reload} onCancel={() => setSelling(null)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="pk-sold" className="space-y-2">
            <h2 id="pk-sold" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("الباقات المباعة", "Packages sold")}</h2>
            {data.sold.length === 0 ? (
              <Empty text={say("لسه متباعش باقات.", "No packages sold yet.")} />
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {data.sold.map((s) => {
                  const left = s.sessionsTotal - s.sessionsUsed;
                  const suggested = Math.floor((s.priceCents * left) / Math.max(1, s.sessionsTotal));
                  return (
                    <li key={s.id} className="card space-y-2 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 font-bold text-[var(--color-ink)]">
                            {s.customerName} <span className="num text-[0.75rem] font-normal text-[var(--color-subtle)]" dir="ltr">{s.phoneE164}</span>
                          </p>
                          <p className="num m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                            {s.plan.nameAr} · {say(`فاضل ${left} من ${s.sessionsTotal}`, `${left} of ${s.sessionsTotal} left`)} · {formatCents(s.priceCents, "EGP", lang)}
                            {s.expiresAt && ` · ${say("تنتهي", "expires")} ${dateShort(s.expiresAt, lang)}`}
                          </p>
                        </div>
                        <Status s={s.status} say={say} />
                      </div>
                      <SoldActions kind="package" id={s.id} status={s.status} suggestedRefundCents={suggested} onDone={reload} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Memberships ─────────────────────────────────────────────────────────────

function MembershipsTab({ services }: { services: Svc[] }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<MembershipsData>("/api/business/memberships");
  const [creating, setCreating] = useState(false);
  const [selling, setSelling] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggle(id: string, isActive: boolean) {
    setBusy(id);
    setActionError(null);
    const r = await togglePlan(`/api/business/memberships/${id}`, isActive);
    setBusy(null);
    if (!r.ok) setActionError(r.data.error ?? say("تعذّر التغيير", "Could not change"));
    else reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button type="button" onClick={() => setCreating((v) => !v)} className="btn btn-primary btn-sm" aria-expanded={creating}>
          <Plus size={14} aria-hidden="true" />
          {say("عضوية جديدة", "New membership")}
        </button>
      </div>
      {creating && (
        <PlanForm kind="membership" services={services} onDone={() => { setCreating(false); reload(); }} onCancel={() => setCreating(false)} />
      )}

      {loading && <Loading say={say} />}
      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {data && (
        <>
          <section aria-labelledby="mb-plans" className="space-y-2">
            <h2 id="mb-plans" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("خطط العضوية", "Membership plans")}</h2>
            {data.plans.length === 0 ? (
              <Empty text={say("لسه مفيش عضويات.", "No memberships yet.")} />
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {data.plans.map((p) => (
                  <li key={p.id} className="card space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 font-bold text-[var(--color-ink)]">
                          {lang === "en" && p.nameEn ? p.nameEn : p.nameAr}
                          {!p.isActive && <span className="ms-2 text-[0.6875rem] font-normal text-[var(--color-subtle)]">{say("موقوفة", "Off")}</span>}
                        </p>
                        <p className="num m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                          {formatCents(p.priceCents, "EGP", lang)} {say(`كل ${p.periodDays} يوم`, `every ${p.periodDays} days`)} · {say(`${p.includedVisits} زيارة`, `${p.includedVisits} visits`)} · {serviceSummary(p.serviceIds, services, say, lang)}
                        </p>
                        <p className="num m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">
                          {say(`${p._count.memberships} مشترك`, `${p._count.memberships} members`)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        {p.isActive && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => setSelling(selling === p.id ? null : p.id)} aria-expanded={selling === p.id}>
                            <ShoppingBag size={12} aria-hidden="true" />
                            {say("بيع", "Sell")}
                          </button>
                        )}
                        <button type="button" className="btn btn-outline btn-sm" disabled={busy === p.id} onClick={() => void toggle(p.id, !p.isActive)}>
                          <Power size={12} aria-hidden="true" />
                          {p.isActive ? say("وقّف", "Turn off") : say("شغّل", "Turn on")}
                        </button>
                      </div>
                    </div>
                    {selling === p.id && (
                      <SellForm kind="membership" planId={p.id} planName={p.nameAr} onDone={reload} onCancel={() => setSelling(null)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="mb-members" className="space-y-2">
            <h2 id="mb-members" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("المشتركين", "Members")}</h2>
            {data.members.length === 0 ? (
              <Empty text={say("لسه مفيش مشتركين.", "No members yet.")} />
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {data.members.map((m) => (
                  <li key={m.id} className="card space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m-0 font-bold text-[var(--color-ink)]">
                          {m.customerName} <span className="num text-[0.75rem] font-normal text-[var(--color-subtle)]" dir="ltr">{m.phoneE164}</span>
                        </p>
                        <p className="num m-0 mt-1 text-[0.78125rem] text-[var(--color-subtle)]">
                          {m.plan.nameAr} · {formatCents(m.priceCents, "EGP", lang)}
                          {m.current && ` · ${say(`استخدم ${m.current.used} من ${m.current.includedVisits} لحد`, `${m.current.used} of ${m.current.includedVisits} used until`)} ${dateShort(m.current.endsAt, lang)}`}
                          {m.paidThrough && ` · ${say("مدفوعة لحد", "paid through")} ${dateShort(m.paidThrough, lang)}`}
                        </p>
                        {(m.cancelAtPeriodEnd || m.pausedDays > 0) && (
                          <p className="num m-0 mt-0.5 text-[0.6875rem] text-[var(--color-subtle)]">
                            {m.cancelAtPeriodEnd && say("هتتلغي آخر الفترة", "Cancels at period end")}
                            {m.cancelAtPeriodEnd && m.pausedDays > 0 && " · "}
                            {m.pausedDays > 0 && say(`اتوقفت ${num(m.pausedDays, lang)} يوم`, `Paused ${num(m.pausedDays, lang)} days so far`)}
                          </p>
                        )}
                      </div>
                      <Status s={m.status} say={say} />
                    </div>
                    <SoldActions kind="membership" id={m.id} status={m.status} suggestedRefundCents={m.priceCents} onDone={reload} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Creating a plan ─────────────────────────────────────────────────────────

function PlanForm({
  kind,
  services,
  onDone,
  onCancel,
}: {
  kind: "package" | "membership";
  services: Svc[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { say } = useSay();
  const [f, setF] = useState({ nameAr: "", nameEn: "", price: "", sessions: "5", validityDays: "180", periodDays: "30", includedVisits: "4", serviceIds: [] as string[] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const p = kind === "package" ? "pp" : "mp";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = poundsToCents(f.price);
    if (!priceCents || priceCents < 1) {
      setError(say("اكتب السعر", "Enter the price"));
      return;
    }
    const base = { nameAr: f.nameAr.trim(), nameEn: f.nameEn.trim() || null, serviceIds: f.serviceIds, priceCents };
    const body = kind === "package"
      ? { ...base, sessions: Number(f.sessions), validityDays: Number(f.validityDays) }
      : { ...base, periodDays: Number(f.periodDays), includedVisits: Number(f.includedVisits) };
    setBusy(true);
    setError(null);
    const r = await api(kind === "package" ? "/api/business/packages" : "/api/business/memberships", "POST", body);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر الحفظ", "Could not save"));
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={say("الاسم", "Name (Arabic)")} htmlFor={`${p}-name`}>
          <input id={`${p}-name`} required minLength={2} maxLength={80} value={f.nameAr} onChange={(e) => setF({ ...f, nameAr: e.target.value })}
            placeholder={kind === "package" ? "باقة 5 جلسات" : "عضوية شهرية"} className={INPUT} />
        </Field>
        <Field label={say("الاسم بالإنجليزي", "Name (English)")} htmlFor={`${p}-name-en`} hint={say("اختياري", "Optional")}>
          <input id={`${p}-name-en`} dir="ltr" maxLength={80} value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} className={INPUT} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={say("السعر (جنيه)", "Price (EGP)")} htmlFor={`${p}-price`}>
          <input id={`${p}-price`} type="number" required min={0.01} step={0.01} dir="ltr" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={INPUT} />
        </Field>
        {kind === "package" ? (
          <>
            <Field label={say("عدد الجلسات", "Sessions")} htmlFor={`${p}-sessions`} hint="1–100">
              <input id={`${p}-sessions`} type="number" required min={1} max={100} dir="ltr" value={f.sessions} onChange={(e) => setF({ ...f, sessions: e.target.value })} className={INPUT} />
            </Field>
            <Field label={say("صالحة لمدة (يوم)", "Valid for (days)")} htmlFor={`${p}-valid`} hint="7–730">
              <input id={`${p}-valid`} type="number" required min={7} max={730} dir="ltr" value={f.validityDays} onChange={(e) => setF({ ...f, validityDays: e.target.value })} className={INPUT} />
            </Field>
          </>
        ) : (
          <>
            <Field label={say("كل كام يوم", "Period (days)")} htmlFor={`${p}-period`} hint="7–366">
              <input id={`${p}-period`} type="number" required min={7} max={366} dir="ltr" value={f.periodDays} onChange={(e) => setF({ ...f, periodDays: e.target.value })} className={INPUT} />
            </Field>
            <Field label={say("زيارات في الفترة", "Visits per period")} htmlFor={`${p}-visits`} hint="1–100">
              <input id={`${p}-visits`} type="number" required min={1} max={100} dir="ltr" value={f.includedVisits} onChange={(e) => setF({ ...f, includedVisits: e.target.value })} className={INPUT} />
            </Field>
          </>
        )}
      </div>
      <ServicePicker
        services={services}
        value={f.serviceIds}
        onChange={(serviceIds) => setF({ ...f, serviceIds })}
        legend={say("الخدمات — سيبها فاضية عشان تشمل أي خدمة", "Services — leave all off to cover any service")}
      />
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {say("احفظ", "Save")}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">{say("إلغاء", "Cancel")}</button>
      </div>
    </form>
  );
}

function Loading({ say }: { say: Say }) {
  return (
    <p className="text-sm text-[var(--color-subtle)]">
      <Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />
      {say("بيحمّل…", "Loading…")}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card p-8 text-center text-[0.875rem] text-[var(--color-subtle)]">{text}</div>;
}
