"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Field, INPUT, api, useSay } from "@/components/dashboard/kit";

export type PayMethod = "CASH" | "CARD" | "WALLET" | "OTHER";

export function methodOptions(say: (ar: string, en: string) => string): [PayMethod, string][] {
  return [
    ["CASH", say("كاش", "Cash")],
    ["CARD", say("كارت", "Card")],
    ["WALLET", say("محفظة", "Wallet")],
    ["OTHER", say("غير كده", "Other")],
  ];
}

/**
 * Selling a package or a membership at the desk, paid in person. The
 * mobile number is the customer's key: bookings under it use the sale.
 */
export default function SellForm({
  kind,
  planId,
  planName,
  onDone,
  onCancel,
}: {
  kind: "package" | "membership";
  planId: string;
  planName: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { say } = useSay();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const id = (s: string) => `sell-${planId}-${s}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api<{ id: string; receiptNumber: string }>("/api/business/packages/sell", "POST", {
      kind, planId, phone: phone.trim(), customerName: name.trim(), method,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر البيع", "Could not sell"));
      return;
    }
    setReceipt(r.data.receiptNumber);
    onDone();
  }

  if (receipt) {
    return (
      <div className="space-y-2">
        <Alert tone="success">
          {say(`اتباع "${planName}". رقم الإيصال: `, `"${planName}" sold. Receipt number: `)}
          <span className="num font-bold" dir="ltr">{receipt}</span>
        </Alert>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">{say("تمام", "Done")}</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <p className="m-0 text-[0.8125rem] font-bold text-[var(--color-ink)]">
        {say(`بيع "${planName}" — الدفع في المكان`, `Sell "${planName}" — paid in person`)}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={say("رقم الموبايل", "Mobile number")} htmlFor={id("phone")}>
          <input id={id("phone")} type="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="01XXXXXXXXX" className={INPUT} />
        </Field>
        <Field label={say("اسم العميل", "Customer name")} htmlFor={id("name")}>
          <input id={id("name")} required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("طريقة الدفع", "Payment method")} htmlFor={id("method")}>
          <select id={id("method")} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)} className={INPUT}>
            {methodOptions(say).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          {say("سجّل البيع", "Record sale")}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">{say("إلغاء", "Cancel")}</button>
      </div>
    </form>
  );
}
