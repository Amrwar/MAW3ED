"use client";

import { useId, useState } from "react";
import { Field, INPUT, StatusChip, api, useLoad, useSay } from "@/components/dashboard/kit";

interface Contract {
  reference: string;
  startsAt: string;
  endsAt: string | null;
  maxApiClients: number;
  maxWebhooks: number;
  apiRequestsPerMinute: number;
  notes: string | null;
}

/** An ISO instant as the YYYY-MM-DD of the browser's own calendar. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** A picked day as the instant its local midnight falls on. */
function isoOf(day: string): string {
  return new Date(`${day}T00:00:00`).toISOString();
}
function today(): string {
  return dayOf(new Date().toISOString());
}

/**
 * What the platform agreed with one organization: the limits on its
 * enterprise tools. No prices are kept here — the reference names the
 * signed agreement, which holds the commercial terms.
 */
export default function OrgContractPanel({ organizationId }: { organizationId: string }) {
  const { lang, say } = useSay();
  const url = `/api/admin/organizations/${organizationId}/contract`;
  const { data, error, loading, reload } = useLoad<{ contract: Contract | null }>(url);

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-4" dir={lang === "en" ? "ltr" : "rtl"}>
      <h3 className="m-0 text-sm font-bold">{say("الاتفاق مع المنصة", "Contract")}</h3>
      <p className="m-0 text-xs text-[var(--color-subtle)]">
        {say(
          "مفيش أسعار بتتسجّل هنا. المرجع بيشاور على الاتفاق الموقّع اللي فيه الشروط التجارية؛ هنا بس حدود أدوات الشركات (مفاتيح API والـ webhooks).",
          "No prices are stored here. The reference names the signed agreement, which holds the commercial terms; this only sets limits on the enterprise tools (API keys and webhooks).",
        )}
      </p>
      {loading && <p className="m-0 text-sm text-[var(--color-subtle)]" role="status">{say("بيحمّل…", "Loading…")}</p>}
      {error && <p className="m-0 text-sm text-[var(--color-danger)]" role="alert">{error}</p>}
      {data && <ContractForm url={url} contract={data.contract} onSaved={reload} />}
    </div>
  );
}

function ContractForm({ url, contract, onSaved }: { url: string; contract: Contract | null; onSaved: () => void }) {
  const { say } = useSay();
  const [f, setF] = useState({
    reference: contract?.reference ?? "",
    startsAt: contract ? dayOf(contract.startsAt) : today(),
    endsAt: contract?.endsAt ? dayOf(contract.endsAt) : "",
    maxApiClients: String(contract?.maxApiClients ?? 2),
    maxWebhooks: String(contract?.maxWebhooks ?? 2),
    apiRequestsPerMinute: String(contract?.apiRequestsPerMinute ?? 120),
    notes: contract?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  // The clock is read when the form opens and after each change, not on every render.
  const [now, setNow] = useState(() => Date.now());
  const inForce = !!contract && new Date(contract.startsAt).getTime() <= now && (!contract.endsAt || new Date(contract.endsAt).getTime() > now);
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.endsAt && f.endsAt <= f.startsAt) {
      setMsg({ ok: false, text: say("النهاية لازم تكون بعد البداية", "The end must be after the start") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const r = await api(url, "PUT", {
      reference: f.reference.trim(),
      startsAt: isoOf(f.startsAt),
      endsAt: f.endsAt ? isoOf(f.endsAt) : null,
      maxApiClients: Number(f.maxApiClients),
      maxWebhooks: Number(f.maxWebhooks),
      apiRequestsPerMinute: Number(f.apiRequestsPerMinute),
      notes: f.notes.trim() || null,
    });
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? say("اتحفظ.", "Saved.") : (r.data.error ?? say("حصلت مشكلة", "Something went wrong")) });
    if (r.ok) {
      setNow(Date.now());
      onSaved();
    }
  }

  async function end() {
    setBusy(true);
    setMsg(null);
    const r = await api(url, "DELETE");
    setBusy(false);
    setConfirmEnd(false);
    setMsg({ ok: r.ok, text: r.ok ? say("الاتفاق انتهى.", "The contract has ended.") : (r.data.error ?? say("حصلت مشكلة", "Something went wrong")) });
    if (r.ok) {
      setNow(Date.now());
      onSaved();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        {!contract ? (
          <StatusChip tone="muted">{say("مفيش اتفاق", "No contract")}</StatusChip>
        ) : inForce ? (
          <StatusChip tone="jade">{say("ساري", "In force")}</StatusChip>
        ) : (
          <StatusChip tone="warn">{say("مش ساري", "Not in force")}</StatusChip>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={say("مرجع الاتفاق الموقّع", "Signed agreement reference")} htmlFor={id("ref")}>
          <input id={id("ref")} className={INPUT} value={f.reference} onChange={set("reference")} required minLength={2} maxLength={80} dir="ltr" />
        </Field>
        <Field label={say("من", "Starts")} htmlFor={id("from")}>
          <input id={id("from")} type="date" className={INPUT} value={f.startsAt} onChange={set("startsAt")} required dir="ltr" />
        </Field>
        <Field label={say("لحد (اختياري)", "Ends (optional)")} htmlFor={id("to")}>
          <input id={id("to")} type="date" className={INPUT} value={f.endsAt} min={f.startsAt} onChange={set("endsAt")} dir="ltr" />
        </Field>
        <Field label={say("أقصى عدد مفاتيح API", "Max API keys")} htmlFor={id("keys")} hint="0–20">
          <input id={id("keys")} type="number" min={0} max={20} step={1} className={INPUT} value={f.maxApiClients} onChange={set("maxApiClients")} required dir="ltr" />
        </Field>
        <Field label={say("أقصى عدد webhooks", "Max webhooks")} htmlFor={id("hooks")} hint="0–20">
          <input id={id("hooks")} type="number" min={0} max={20} step={1} className={INPUT} value={f.maxWebhooks} onChange={set("maxWebhooks")} required dir="ltr" />
        </Field>
        <Field label={say("طلبات API في الدقيقة", "API requests per minute")} htmlFor={id("rpm")} hint="10–6000">
          <input id={id("rpm")} type="number" min={10} max={6000} step={1} className={INPUT} value={f.apiRequestsPerMinute} onChange={set("apiRequestsPerMinute")} required dir="ltr" />
        </Field>
      </div>
      <Field label={say("ملاحظات (اختياري، من غير أسعار)", "Notes (optional, no prices)")} htmlFor={id("notes")}>
        <textarea id={id("notes")} className={INPUT} rows={2} value={f.notes} onChange={set("notes")} maxLength={500} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? say("بيحفظ…", "Saving…") : contract ? say("حدّث الاتفاق", "Update contract") : say("سجّل الاتفاق", "Record contract")}
        </button>
        {inForce && !confirmEnd && (
          <button type="button" className="btn btn-ghost btn-sm text-[var(--color-danger)]" disabled={busy} onClick={() => setConfirmEnd(true)}>
            {say("أنهِ الاتفاق دلوقتي", "End it now")}
          </button>
        )}
      </div>
      {confirmEnd && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3" role="group" aria-label={say("تأكيد إنهاء الاتفاق", "Confirm ending the contract")}>
          <p className="m-0 flex-1 text-sm">
            {say(
              "مفاتيح الـ API هتقف والـ webhooks مش هتتبعت. مفيش حاجة هتتمسح. متأكد؟",
              "API keys stop working and webhooks stop sending. Nothing is deleted. Are you sure?",
            )}
          </p>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void end()}>
            {say("أيوه، أنهِه", "Yes, end it")}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirmEnd(false)}>
            {say("لأ", "No")}
          </button>
        </div>
      )}
      <p role="status" className={`m-0 min-h-4 text-sm ${msg?.ok ? "text-[var(--color-ok)]" : "text-[var(--color-danger)]"}`}>{msg?.text}</p>
    </form>
  );
}
