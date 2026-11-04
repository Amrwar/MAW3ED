"use client";

import { useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import Alert from "@/components/ui/Alert";
import LoyaltyRulesForm, { type LoyaltyRules } from "@/components/dashboard/LoyaltyRulesForm";
import { Field, INPUT, PageHeader, Stat, StatusChip, api, useLoad, useSay } from "@/components/dashboard/kit";
import { dateFull, dateShort, num } from "@/lib/fmt";

interface Overview {
  program: (LoyaltyRules & { id: string; updatedAt: string }) | null;
  stats: { accounts: number; outstandingPoints: number; earnedLast30: number; redeemedLast30: number };
  invitations: { id: string; programId: string; programName: string; organizationName: string | null; accepted: boolean; left: boolean }[];
}

interface CustomerPoints {
  program: { id: string; nameAr: string } | null;
  balance?: number;
  available?: number;
  lifetimeEarned?: number;
  entries?: { id: string; kind: string; points: number; expiresAt: string | null; createdAt: string; note: string | null; here: boolean }[];
}

const KIND: Record<string, [string, string]> = {
  EARN: ["كسب", "Earned"],
  EARN_REVERSAL: ["إلغاء كسب", "Earn reversed"],
  REDEEM: ["صرف", "Redeemed"],
  REDEEM_REVERSAL: ["رجوع نقاط", "Redeem reversed"],
  EXPIRE: ["انتهت", "Expired"],
  ADJUST: ["تعديل يدوي", "Adjustment"],
};

export default function LoyaltyClient() {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<Overview>("/api/business/loyalty");

  return (
    <div className="space-y-6">
      <PageHeader
        title={say("النقاط والولاء", "Loyalty")}
        sub={say(
          "العميل بيكسب نقاط على كل زيارة مكتملة وبيصرفها خصم على حجز جاي. تغيير القواعد مش بيغيّر نقاط اتكسبت قبل كده.",
          "Customers earn points on each completed visit and spend them as a discount on a later booking. Changing the rules never changes points already earned.",
        )}
      />

      {loading && <p className="text-sm text-[var(--color-subtle)]"><Loader2 size={14} className="me-1 inline animate-spin" aria-hidden="true" />{say("بيحمّل…", "Loading…")}</p>}
      {error && <Alert tone="danger">{error === "network" ? say("تعذّر الاتصال", "Could not connect") : error}</Alert>}

      {data && (
        <>
          {data.program && (
            <section aria-label={say("الأرقام", "Figures")} className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label={say("عملاء عندهم نقاط", "Customers with points")} value={num(data.stats.accounts, lang)} />
              <Stat label={say("نقاط لسه متصرفتش", "Outstanding points")} value={num(data.stats.outstandingPoints, lang)} />
              <Stat label={say("اتكسبت آخر 30 يوم", "Earned, last 30 days")} value={num(data.stats.earnedLast30, lang)} />
              <Stat label={say("اتصرفت آخر 30 يوم", "Redeemed, last 30 days")} value={num(data.stats.redeemedLast30, lang)} />
            </section>
          )}

          <section aria-labelledby="rules-h" className="space-y-2">
            <h2 id="rules-h" className="m-0 text-base font-bold text-[var(--color-ink)]">
              {data.program ? say("قواعد البرنامج", "Program rules") : say("ابدأ برنامج نقاط", "Start a points program")}
            </h2>
            <LoyaltyRulesForm
              key={data.program?.updatedAt ?? "new"}
              endpoint="/api/business/loyalty"
              initial={data.program}
              onSaved={reload}
            />
          </section>

          {data.program && <CustomerLookup />}

          <Invitations invitations={data.invitations} onChanged={reload} />
        </>
      )}
    </div>
  );
}

function CustomerLookup() {
  const { lang, say } = useSay();
  const [phone, setPhone] = useState("");
  const [looked, setLooked] = useState<{ phone: string; result: CustomerPoints } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  async function lookup(p: string) {
    setBusy(true);
    setError(null);
    const r = await api<CustomerPoints>(`/api/business/loyalty/customer?phone=${encodeURIComponent(p)}`);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر البحث", "Lookup failed"));
      setLooked(null);
      return;
    }
    setLooked({ phone: p, result: r.data });
  }

  const res = looked?.result;

  return (
    <section aria-labelledby="cust-h" className="space-y-3">
      <h2 id="cust-h" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("نقاط عميل", "A customer's points")}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (phone.trim()) void lookup(phone.trim());
        }}
        className="card flex flex-wrap items-end gap-2 p-4"
      >
        <div className="min-w-[12rem] flex-1">
          <Field label={say("رقم الموبايل", "Mobile number")} htmlFor="lc-phone">
            <input id="lc-phone" type="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX" className={INPUT} />
          </Field>
        </div>
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Search size={13} aria-hidden="true" />}
          {say("دوّر", "Look up")}
        </button>
      </form>

      {error && <Alert tone="danger">{error}</Alert>}

      {looked && res && !res.program && (
        <Alert tone="info">{say("مفيش برنامج نقاط شغّال للرقم ده هنا.", "No active points program applies here.")}</Alert>
      )}

      {looked && res?.program && (
        <div className="card space-y-3 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={say("الرصيد", "Balance")} value={num(res.balance ?? 0, lang)} />
            <Stat label={say("متاح للصرف", "Available")} value={num(res.available ?? 0, lang)} />
            <Stat label={say("اتكسب إجمالًا", "Earned in total")} value={num(res.lifetimeEarned ?? 0, lang)} />
          </div>

          <button type="button" onClick={() => setAdjustOpen((v) => !v)} className="btn btn-outline btn-sm" aria-expanded={adjustOpen}>
            <SlidersHorizontal size={13} aria-hidden="true" />
            {say("تعديل يدوي", "Adjust points")}
          </button>
          {adjustOpen && (
            <AdjustForm
              phone={looked.phone}
              onDone={() => {
                setAdjustOpen(false);
                void lookup(looked.phone);
              }}
            />
          )}

          {(res.entries?.length ?? 0) === 0 ? (
            <p className="m-0 text-sm text-[var(--color-subtle)]">{say("لسه مفيش حركات.", "No entries yet.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-[0.8125rem]">
                <thead>
                  <tr className="text-start text-[0.75rem] text-[var(--color-subtle)]">
                    <th className="p-2 text-start font-semibold">{say("التاريخ", "Date")}</th>
                    <th className="p-2 text-start font-semibold">{say("النوع", "Kind")}</th>
                    <th className="p-2 text-start font-semibold">{say("النقاط", "Points")}</th>
                    <th className="p-2 text-start font-semibold">{say("تنتهي", "Expires")}</th>
                    <th className="p-2 text-start font-semibold">{say("ملاحظة", "Note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.entries!.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--color-line)]">
                      <td className="num p-2">{dateShort(e.createdAt, lang)}</td>
                      <td className="p-2">
                        {say(...(KIND[e.kind] ?? [e.kind, e.kind]))}
                        {!e.here && <span className="ms-1 text-[0.6875rem] text-[var(--color-subtle)]">{say("(فرع تاني)", "(another brand)")}</span>}
                      </td>
                      <td className={`num p-2 font-bold ${e.points < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-jade)]"}`} dir="ltr">
                        {e.points > 0 ? "+" : ""}{num(e.points, lang)}
                      </td>
                      <td className="num p-2">{e.expiresAt ? dateFull(e.expiresAt, lang) : "—"}</td>
                      <td className="p-2 text-[var(--color-subtle)]">{e.note ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AdjustForm({ phone, onDone }: { phone: string; onDone: () => void }) {
  const { say } = useSay();
  // One key per opening of the form: a double-submit is applied once.
  const [key] = useState(() => crypto.randomUUID());
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(points);
    if (!Number.isInteger(n) || n === 0) {
      setError(say("اكتب عدد نقاط صحيح (بالسالب للخصم)", "Enter a whole number of points (negative to remove)"));
      return;
    }
    setBusy(true);
    setError(null);
    const r = await api<{ applied: boolean }>("/api/business/loyalty/customer", "POST", { phone, points: n, note: note.trim(), key });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر التعديل", "Could not adjust"));
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Field label={say("النقاط", "Points")} htmlFor="la-points" hint={say("بالسالب عشان تشيل", "Negative to remove")}>
          <input id="la-points" type="number" step={1} required dir="ltr" value={points}
            onChange={(e) => setPoints(e.target.value)} className={INPUT} />
        </Field>
        <Field label={say("السبب", "Reason")} htmlFor="la-note" hint={say("بيتسجّل مع اسمك", "Recorded with your name")}>
          <input id="la-note" required minLength={3} maxLength={300} value={note}
            onChange={(e) => setNote(e.target.value)} className={INPUT} />
        </Field>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
        {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
        {say("سجّل التعديل", "Record adjustment")}
      </button>
    </form>
  );
}

function Invitations({ invitations, onChanged }: { invitations: Overview["invitations"]; onChanged: () => void }) {
  const { say } = useSay();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (invitations.length === 0) return null;

  async function act(id: string, action: "accept" | "leave") {
    setBusy(id);
    setError(null);
    const r = await api("/api/business/loyalty/participation", "POST", { participationId: id, action });
    setBusy(null);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر التغيير", "Could not change"));
      return;
    }
    onChanged();
  }

  return (
    <section aria-labelledby="inv-h" className="space-y-2">
      <h2 id="inv-h" className="m-0 text-base font-bold text-[var(--color-ink)]">{say("برامج المجموعات", "Organization programs")}</h2>
      <p className="m-0 text-[0.8125rem] text-[var(--color-subtle)]">
        {say(
          "مجموعة بتملك نشاطك دعتك لبرنامج نقاط مشترك بين فروعها. لو عندك برنامج خاص شغّال، برنامجك هو اللي بيتطبّق.",
          "An organization that owns your business invited you to a points program shared across its brands. While your own program is on, yours applies.",
        )}
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
      <ul className="m-0 list-none space-y-2 p-0">
        {invitations.map((i) => (
          <li key={i.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="m-0 font-bold text-[var(--color-ink)]">{i.programName}</p>
              <p className="m-0 mt-0.5 text-[0.75rem] text-[var(--color-subtle)]">
                {i.organizationName ?? ""}{" "}
                {i.accepted ? <StatusChip tone="jade">{say("مشترك", "Joined")}</StatusChip>
                  : i.left ? <StatusChip tone="muted">{say("خرجت منه", "Left")}</StatusChip>
                  : <StatusChip tone="warn">{say("دعوة جديدة", "Invited")}</StatusChip>}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === i.id}
              onClick={() => void act(i.id, i.accepted ? "leave" : "accept")}
              className={i.accepted ? "btn btn-outline btn-sm" : "btn btn-primary btn-sm"}
            >
              {busy === i.id && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
              {i.accepted ? say("اخرج من البرنامج", "Leave") : say("اشترك", "Join")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
