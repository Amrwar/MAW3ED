"use client";

import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { api, useSay } from "@/components/dashboard/kit";
import { formatCents } from "@/lib/payments/money";
import { redemptionFor } from "@/lib/loyalty/rules";
import { dateShort } from "@/lib/fmt";

export type WalletChoice =
  | { kind: "none" }
  | { kind: "package"; id: string }
  | { kind: "membership"; id: string }
  | { kind: "points"; points: number };

interface WalletReply {
  loyalty: { programName: string; available: number; redeemPoints: number; redeemValueCents: number; maxRedeemPercent: number } | null;
  entitlements: { kind: "package" | "membership"; id: string; nameAr: string; nameEn: string | null; left: number; expiresAt: string | null }[];
}

/** What the choice adds to a desk booking's POST body. */
export function walletFields(c: WalletChoice): Record<string, unknown> {
  if (c.kind === "package") return { usePackageId: c.id };
  if (c.kind === "membership") return { useMembershipId: c.id };
  if (c.kind === "points" && c.points > 0) return { redeemPoints: c.points };
  return {};
}

/**
 * At the desk: what this number holds here that the booking could use —
 * a package session, a membership visit, or points. Asked for on a tap,
 * not as the number is typed. The parent remounts this (by key) when
 * the phone, service or time changes, so an answer never outlives them.
 */
export default function DeskWallet({
  phone,
  serviceId,
  date,
  time,
  priceCents,
  value,
  onChange,
}: {
  phone: string;
  serviceId: string;
  date?: string;
  time?: string;
  priceCents: number;
  value: WalletChoice;
  onChange: (c: WalletChoice) => void;
}) {
  const { lang, say } = useSay();
  const [reply, setReply] = useState<WalletReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    const q = new URLSearchParams({ phone: phone.trim(), serviceId });
    if (date) q.set("date", date);
    if (time) q.set("time", time);
    const r = await api<WalletReply>(`/api/business/wallet?${q}`);
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? say("تعذّر قراءة الرصيد", "Could not read the balance"));
      return;
    }
    setReply(r.data);
  }

  if (!reply) {
    return (
      <div className="space-y-2">
        <button type="button" className="btn btn-outline btn-sm" disabled={busy || !phone.trim() || !serviceId} onClick={() => void check()}>
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Wallet size={13} aria-hidden="true" />}
          {say("رصيد العميل (باقة / عضوية / نقاط)", "Customer balance (package / membership / points)")}
        </button>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  const l = reply.loyalty;
  const rules = l ? { pointsPerVisit: 0, pointsPer100Egp: 0, expiryDays: null, dailyEarnCap: 1, redeemPoints: l.redeemPoints, redeemValueCents: l.redeemValueCents, maxRedeemPercent: l.maxRedeemPercent } : null;
  const best = rules && l ? redemptionFor(rules, l.available, l.available, priceCents) : null;
  const chosenPoints = value.kind === "points" && rules && l ? redemptionFor(rules, value.points, l.available, priceCents) : null;
  const nothing = reply.entitlements.length === 0 && (!best || best.points === 0);

  return (
    <fieldset className="m-0 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <legend className="px-1 text-xs font-semibold text-[var(--color-subtle)]">{say("استخدم رصيد العميل", "Use the customer's balance")}</legend>
      {nothing ? (
        <p className="m-0 text-sm text-[var(--color-subtle)]">
          {say("مفيش رصيد ينفع للخدمة دي.", "Nothing usable for this service.")}
          {l && ` ${say(`(${l.available} نقطة — مش كفاية للخصم)`, `(${l.available} points — not enough to redeem)`)}`}
        </p>
      ) : (
        <>
          <Radio name="wallet" checked={value.kind === "none"} onChange={() => onChange({ kind: "none" })} label={say("لأ، يدفع عادي", "No, pays as usual")} />
          {reply.entitlements.map((e) => (
            <Radio
              key={e.id}
              name="wallet"
              checked={(value.kind === "package" || value.kind === "membership") && value.id === e.id}
              onChange={() => onChange(e.kind === "package" ? { kind: "package", id: e.id } : { kind: "membership", id: e.id })}
              label={`${lang === "en" && e.nameEn ? e.nameEn : e.nameAr} — ${e.kind === "package" ? say("باقة", "package") : say("عضوية", "membership")}, ${say(`فاضل ${e.left}`, `${e.left} left`)}${e.expiresAt ? ` · ${say("لحد", "until")} ${dateShort(e.expiresAt, lang)}` : ""}`}
            />
          ))}
          {l && best && best.points > 0 && (
            <div>
              <Radio
                name="wallet"
                checked={value.kind === "points"}
                onChange={() => onChange({ kind: "points", points: best.points })}
                label={say(
                  `نقاط "${l.programName}": متاح ${l.available} — أقصى خصم ${formatCents(best.amountCents, "EGP", lang)} بـ ${best.points} نقطة`,
                  `"${l.programName}" points: ${l.available} available — up to ${formatCents(best.amountCents, "EGP", lang)} off for ${best.points} points`,
                )}
              />
              {value.kind === "points" && (
                <div className="ms-7 mt-1 flex flex-wrap items-center gap-2">
                  <label htmlFor="wallet-points" className="text-xs text-[var(--color-subtle)]">{say("عدد النقاط", "Points")}</label>
                  <input
                    id="wallet-points"
                    type="number"
                    dir="ltr"
                    min={l.redeemPoints}
                    max={best.points}
                    step={l.redeemPoints}
                    value={value.points}
                    onChange={(e) => onChange({ kind: "points", points: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                    className="input w-28"
                  />
                  {chosenPoints && (
                    <span className="num text-xs text-[var(--color-subtle)]">
                      {chosenPoints.points > 0
                        ? say(`= خصم ${formatCents(chosenPoints.amountCents, "EGP", lang)} (${chosenPoints.points} نقطة)`, `= ${formatCents(chosenPoints.amountCents, "EGP", lang)} off (${chosenPoints.points} points)`)
                        : say(`أقل خصم ${l.redeemPoints} نقطة`, `Minimum is ${l.redeemPoints} points`)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

function Radio({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-start gap-2 text-sm text-[var(--color-ink)]">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1" />
      <span className="num">{label}</span>
    </label>
  );
}
