"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Alert from "@/components/ui/Alert";
import Toggle from "@/components/ui/Toggle";
import { formatCents } from "@/lib/payments/money";
import { Field, INPUT, api, useSay } from "./kit";

/** The rules of a loyalty program, as the API sends and takes them. */
export interface LoyaltyRules {
  nameAr: string;
  nameEn: string | null;
  isActive: boolean;
  pointsPerVisit: number;
  pointsPer100Egp: number;
  redeemPoints: number;
  redeemValueCents: number;
  maxRedeemPercent: number;
  expiryDays: number | null;
  dailyEarnCap: number;
}

const DEFAULTS: LoyaltyRules = {
  nameAr: "",
  nameEn: null,
  isActive: true,
  pointsPerVisit: 10,
  pointsPer100Egp: 0,
  redeemPoints: 100,
  redeemValueCents: 5000,
  maxRedeemPercent: 50,
  expiryDays: 365,
  dailyEarnCap: 2,
};

type Form = Record<
  "nameAr" | "nameEn" | "pointsPerVisit" | "pointsPer100Egp" | "redeemPoints" | "redeemValue" | "maxRedeemPercent" | "expiryDays" | "dailyEarnCap",
  string
> & { isActive: boolean; neverExpire: boolean };

function toForm(r: LoyaltyRules): Form {
  return {
    nameAr: r.nameAr,
    nameEn: r.nameEn ?? "",
    isActive: r.isActive,
    pointsPerVisit: String(r.pointsPerVisit),
    pointsPer100Egp: String(r.pointsPer100Egp),
    redeemPoints: String(r.redeemPoints),
    redeemValue: String(r.redeemValueCents / 100),
    maxRedeemPercent: String(r.maxRedeemPercent),
    expiryDays: String(r.expiryDays ?? 365),
    neverExpire: r.expiryDays === null,
    dailyEarnCap: String(r.dailyEarnCap),
  };
}

const int = (v: string) => (v.trim() === "" ? NaN : Number(v));

/**
 * The form for a loyalty program's rules, shared by a business's own
 * program and an organization's. It PUTs the whole rule set to
 * `endpoint` and hands the answer back; a preview says in one sentence
 * what the numbers mean to a customer.
 */
export default function LoyaltyRulesForm({
  endpoint,
  initial,
  onSaved,
  idPrefix = "lr",
}: {
  endpoint: string;
  initial: LoyaltyRules | null;
  onSaved: (json: Record<string, unknown>) => void;
  idPrefix?: string;
}) {
  const { lang, say } = useSay();
  const [form, setForm] = useState<Form>(() => toForm(initial ?? DEFAULTS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const redeemPoints = int(form.redeemPoints);
  const redeemCents = Math.round(Number(form.redeemValue) * 100);
  const maxPct = int(form.maxRedeemPercent);
  const perVisit = int(form.pointsPerVisit);
  const per100 = int(form.pointsPer100Egp);
  const previewOk = redeemPoints >= 1 && redeemCents >= 1 && maxPct >= 0;

  const earnBits: string[] = [];
  if (perVisit > 0) earnBits.push(say(`${perVisit} نقطة لكل زيارة`, `${perVisit} points per visit`));
  if (per100 > 0) earnBits.push(say(`${per100} نقطة لكل 100 جنيه`, `${per100} points per 100 EGP`));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const body = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim() || null,
      isActive: form.isActive,
      pointsPerVisit: int(form.pointsPerVisit),
      pointsPer100Egp: int(form.pointsPer100Egp),
      redeemPoints,
      redeemValueCents: redeemCents,
      maxRedeemPercent: maxPct,
      expiryDays: form.neverExpire ? null : int(form.expiryDays),
      dailyEarnCap: int(form.dailyEarnCap),
    };
    if (Object.values(body).some((v) => typeof v === "number" && !Number.isFinite(v))) {
      setError(say("في رقم ناقص أو غلط", "A number is missing or invalid"));
      return;
    }
    setBusy(true);
    const r = await api(endpoint, "PUT", body);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر الحفظ", "Could not save"));
      return;
    }
    setSaved(true);
    onSaved(r.data);
  }

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={say("اسم البرنامج", "Program name (Arabic)")} htmlFor={id("name")}>
          <input id={id("name")} required minLength={2} maxLength={80} value={form.nameAr}
            onChange={(e) => set("nameAr", e.target.value)} placeholder="نقاط مواعيد" className={INPUT} />
        </Field>
        <Field label={say("الاسم بالإنجليزي", "Program name (English)")} htmlFor={id("name-en")} hint={say("اختياري", "Optional")}>
          <input id={id("name-en")} dir="ltr" maxLength={80} value={form.nameEn}
            onChange={(e) => set("nameEn", e.target.value)} className={INPUT} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={say("نقاط لكل زيارة", "Points per visit")} htmlFor={id("ppv")}>
          <input id={id("ppv")} type="number" required min={0} max={10000} dir="ltr" value={form.pointsPerVisit}
            onChange={(e) => set("pointsPerVisit", e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("نقاط لكل 100 جنيه", "Points per 100 EGP")} htmlFor={id("p100")} hint={say("0 = مش بالمبلغ", "0 = off")}>
          <input id={id("p100")} type="number" required min={0} max={10000} dir="ltr" value={form.pointsPer100Egp}
            onChange={(e) => set("pointsPer100Egp", e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("أقصى زيارات بنقاط في اليوم", "Earning visits per day (max)")} htmlFor={id("cap")}>
          <input id={id("cap")} type="number" required min={1} max={10} dir="ltr" value={form.dailyEarnCap}
            onChange={(e) => set("dailyEarnCap", e.target.value)} className={INPUT} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={say("عدد النقاط للخصم", "Points to redeem")} htmlFor={id("rp")}>
          <input id={id("rp")} type="number" required min={1} max={1000000} dir="ltr" value={form.redeemPoints}
            onChange={(e) => set("redeemPoints", e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("قيمة الخصم (جنيه)", "Worth (EGP)")} htmlFor={id("rv")}>
          <input id={id("rv")} type="number" required min={0.01} step={0.01} dir="ltr" value={form.redeemValue}
            onChange={(e) => set("redeemValue", e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("أقصى نسبة من الحجز", "Max share of a booking (%)")} htmlFor={id("mp")}>
          <input id={id("mp")} type="number" required min={0} max={100} dir="ltr" value={form.maxRedeemPercent}
            onChange={(e) => set("maxRedeemPercent", e.target.value)} className={INPUT} />
        </Field>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-2">
        <Field label={say("النقاط بتنتهي بعد (يوم)", "Points expire after (days)")} htmlFor={id("exp")} hint={say("من 30 لـ 3650 يوم", "30 to 3650 days")}>
          <input id={id("exp")} type="number" min={30} max={3650} dir="ltr" disabled={form.neverExpire}
            required={!form.neverExpire} value={form.expiryDays}
            onChange={(e) => set("expiryDays", e.target.value)} className={INPUT} />
        </Field>
        <Toggle label={say("النقاط مش بتنتهي", "Points never expire")} checked={form.neverExpire}
          onChange={(v) => set("neverExpire", v)} />
      </div>

      <Toggle
        label={say("البرنامج شغّال", "Program is on")}
        hint={say("لما يتوقف، العملاء مش بيكسبوا ولا بيصرفوا نقاط، والرصيد بيفضل محفوظ", "When off, customers neither earn nor spend; balances are kept")}
        checked={form.isActive}
        onChange={(v) => set("isActive", v)}
      />

      {previewOk && (
        <p className="num m-0 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] p-3 text-[0.8125rem] text-[var(--color-ink)]" aria-live="polite">
          {say(
            `${redeemPoints} نقطة = خصم ${formatCents(redeemCents, "EGP", lang)}، بحد أقصى ${maxPct}% من الحجز.`,
            `${redeemPoints} points = ${formatCents(redeemCents, "EGP", lang)} off, at most ${maxPct}% of a booking.`,
          )}
          {earnBits.length > 0 && " " + say(`العميل بيكسب ${earnBits.join(" و")}.`, `Customers earn ${earnBits.join(" and ")}.`)}
          {earnBits.length === 0 && " " + say("مفيش طريقة لكسب نقاط دلوقتي.", "There is currently no way to earn points.")}
        </p>
      )}

      {error && <Alert tone="danger">{error}</Alert>}
      {saved && <Alert tone="success">{say("اتحفظ.", "Saved.")}</Alert>}

      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
        {say("احفظ القواعد", "Save rules")}
      </button>
    </form>
  );
}
