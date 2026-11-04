"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Field, INPUT, api, poundsToCents, useSay } from "@/components/dashboard/kit";
import { methodOptions, type PayMethod } from "./SellForm";

type Open = null | "refund" | "renew" | "cancel";

/**
 * What the desk does to a package or membership already sold: cancel,
 * refund the money handed back in person, and for a membership renew,
 * pause and resume. The server says no in words (Arabic) when a step
 * does not apply; that text is shown as it comes.
 */
export default function SoldActions({
  kind,
  id,
  status,
  suggestedRefundCents,
  onDone,
}: {
  kind: "package" | "membership";
  id: string;
  status: string;
  suggestedRefundCents: number;
  onDone: () => void;
}) {
  const { say } = useSay();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => (suggestedRefundCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [when, setWhen] = useState<"now" | "period-end">("period-end");

  async function run(body: Record<string, unknown>, tag: string) {
    setBusy(tag);
    setError(null);
    const r = await api(`/api/business/packages/sold/${id}`, "POST", { kind, ...body });
    setBusy(null);
    if (!r.ok) {
      setError(r.data.error ?? say("مينفعش", "Not possible"));
      return;
    }
    setOpen(null);
    onDone();
  }

  const live = status === "ACTIVE" || status === "PAUSED" || status === "PENDING_PAYMENT";
  const isMember = kind === "membership";
  const spin = (tag: string) => busy === tag && <Loader2 size={12} className="animate-spin" aria-hidden="true" />;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {isMember && (status === "ACTIVE" || status === "EXPIRED") && (
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={open === "renew"} onClick={() => setOpen(open === "renew" ? null : "renew")}>
            {say("تجديد", "Renew")}
          </button>
        )}
        {isMember && status === "ACTIVE" && (
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void run({ action: "pause" }, "pause")}>
            {spin("pause")}{say("إيقاف مؤقت", "Pause")}
          </button>
        )}
        {isMember && status === "PAUSED" && (
          <button type="button" className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => void run({ action: "resume" }, "resume")}>
            {spin("resume")}{say("استئناف", "Resume")}
          </button>
        )}
        {live && (
          <button type="button" className="btn btn-outline btn-sm" aria-expanded={open === "cancel"} onClick={() => setOpen(open === "cancel" ? null : "cancel")}>
            {say("إلغاء", "Cancel")}
          </button>
        )}
        {status !== "REFUNDED" && (
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open === "refund"} onClick={() => setOpen(open === "refund" ? null : "refund")}>
            {say("استرداد", "Refund")}
          </button>
        )}
      </div>

      {open === "renew" && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label={say("طريقة الدفع", "Payment method")} htmlFor={`renew-${id}`}>
            <select id={`renew-${id}`} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={INPUT}>
              {methodOptions(say).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => void run({ action: "renew", method }, "renew")}>
            {spin("renew")}{say("سجّل التجديد", "Record renewal")}
          </button>
        </div>
      )}

      {open === "cancel" && (
        <div className="flex flex-wrap items-end gap-2">
          {isMember && (
            <Field label={say("امتى؟", "When?")} htmlFor={`cancel-${id}`}>
              <select id={`cancel-${id}`} value={when} onChange={(e) => setWhen(e.target.value as "now" | "period-end")} className={INPUT}>
                <option value="period-end">{say("آخر الفترة المدفوعة", "At the end of the paid period")}</option>
                <option value="now">{say("دلوقتي", "Now")}</option>
              </select>
            </Field>
          )}
          <button type="button" className="btn btn-primary btn-sm" disabled={!!busy}
            onClick={() => void run(isMember ? { action: "cancel", when } : { action: "cancel" }, "cancel")}>
            {spin("cancel")}{say("أكّد الإلغاء", "Confirm cancel")}
          </button>
        </div>
      )}

      {open === "refund" && (
        <form
          className="grid gap-2 sm:grid-cols-[9rem_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const cents = poundsToCents(amount);
            if (!cents || cents < 1) {
              setError(say("اكتب المبلغ", "Enter the amount"));
              return;
            }
            void run({ action: "refund", amountCents: cents, reason: reason.trim() }, "refund");
          }}
        >
          <Field label={say("المبلغ (جنيه)", "Amount (EGP)")} htmlFor={`ra-${id}`}>
            <input id={`ra-${id}`} type="number" min={0.01} step={0.01} required dir="ltr" value={amount}
              onChange={(e) => setAmount(e.target.value)} className={INPUT} />
          </Field>
          <Field label={say("السبب", "Reason")} htmlFor={`rr-${id}`}>
            <input id={`rr-${id}`} required minLength={3} maxLength={500} value={reason}
              onChange={(e) => setReason(e.target.value)} className={INPUT} />
          </Field>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!!busy}>
            {spin("refund")}{say("سجّل الاسترداد", "Record refund")}
          </button>
        </form>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
