"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { StatusChip, api, useLoad, useSay } from "@/components/dashboard/kit";
import { dateShort } from "@/lib/fmt";

export interface SeriesResult {
  seriesId: string;
  made: { index: number; date: string; bookingId: string }[];
  skipped: { index: number; date: string; why: string }[];
}

const WHY: Record<string, [string, string]> = {
  "service-not-found": ["الخدمة مش موجودة", "Service not found"],
  "slot-unavailable": ["الميعاد مش متاح (مقفول أو برّه المواعيد)", "Time unavailable (closed or outside hours)"],
  "slot-taken": ["الميعاد محجوز", "Time already booked"],
  "limit-reached": ["وصلت حد الحجوزات", "Booking limit reached"],
  "party-too-large": ["العدد أكبر من المكان", "Party too large"],
  "business-published": ["اتغيّرت حالة النشاط", "Business state changed"],
  "discount-gone": ["العرض خلص", "Offer ended"],
  "loyalty-insufficient": ["النقاط مش كفاية", "Not enough points"],
  "entitlement-gone": ["الباقة خلصت", "Package used up"],
};

/** What a new series made, and which dates it skipped and why. */
export function SeriesResultView({ result }: { result: SeriesResult }) {
  const { lang, say } = useSay();
  return (
    <div className="space-y-3 py-2">
      <Alert tone={result.made.length > 0 ? "success" : "warning"}>
        {say(
          `اتعمل ${result.made.length} حجز${result.skipped.length ? ` واتساب ${result.skipped.length}` : ""}.`,
          `${result.made.length} bookings made${result.skipped.length ? `, ${result.skipped.length} skipped` : ""}.`,
        )}
      </Alert>
      <ul className="m-0 list-none space-y-1 p-0 text-sm">
        {[...result.made.map((m) => ({ ...m, ok: true as const, why: "" })), ...result.skipped.map((s) => ({ ...s, ok: false as const }))]
          .sort((a, b) => a.index - b.index)
          .map((r) => (
            <li key={r.index} className="flex items-start gap-2">
              {r.ok ? (
                <Check size={14} className="mt-0.5 shrink-0 text-[var(--color-ok)]" aria-label={say("اتعمل", "Made")} />
              ) : (
                <X size={14} className="mt-0.5 shrink-0 text-[var(--color-danger)]" aria-label={say("اتساب", "Skipped")} />
              )}
              <span className="num">{dateShort(r.date, lang)}</span>
              {!r.ok && <span className="text-[var(--color-subtle)]">— {say(...(WHY[r.why] ?? [r.why, r.why]))}</span>}
            </li>
          ))}
      </ul>
    </div>
  );
}

interface SeriesRow {
  id: string;
  customerName: string;
  customerPhone: string;
  intervalWeeks: number;
  occurrences: number;
  startDate: string;
  startTime: string;
  status: "ACTIVE" | "CANCELLED";
  serviceId: string;
  bookings: { id: string; date: string; status: string; seriesIndex: number | null }[];
}

/** The business's recurring series, each with a way to end it. */
export function SeriesList({ serviceName }: { serviceName: (id: string) => string }) {
  const { lang, say } = useSay();
  const { data, error, loading, reload } = useLoad<{ series: SeriesRow[] }>("/api/business/series");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function cancel(id: string) {
    setBusy(id);
    setMsg(null);
    const r = await api<{ cancelled: number; changed: number }>(`/api/business/series/${id}`, "DELETE");
    setBusy(null);
    if (!r.ok) {
      setMsg({ ok: false, text: r.data.error ?? say("تعذّر الإلغاء", "Could not cancel") });
      return;
    }
    setMsg({ ok: true, text: say(`اتلغى ${r.data.cancelled} حجز جاي.`, `${r.data.cancelled} upcoming bookings cancelled.`) });
    reload();
  }

  if (loading) return <p className="m-0 text-xs text-[var(--color-subtle)]"><Loader2 size={12} className="me-1 inline animate-spin" aria-hidden="true" />{say("بيحمّل…", "Loading…")}</p>;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data || data.series.length === 0) return <p className="m-0 text-xs text-[var(--color-subtle)]">{say("مفيش حجوزات متكررة.", "No recurring series.")}</p>;

  return (
    <div className="space-y-2">
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <ul className="m-0 list-none space-y-2 p-0">
        {data.series.map((s) => (
          <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3 text-sm">
            <div className="min-w-0">
              <p className="m-0 font-bold text-[var(--color-ink)]">{s.customerName} · {serviceName(s.serviceId)}</p>
              <p className="num m-0 text-xs text-[var(--color-subtle)]">
                {say(`كل ${s.intervalWeeks === 1 ? "أسبوع" : `${s.intervalWeeks} أسابيع`}`, `Every ${s.intervalWeeks === 1 ? "week" : `${s.intervalWeeks} weeks`}`)}
                {" · "}{s.startTime}{" · "}{say("من", "from")} {dateShort(s.startDate, lang)}
                {" · "}{say(`${s.bookings.length} حجز`, `${s.bookings.length} bookings`)}
              </p>
            </div>
            {s.status === "ACTIVE" ? (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy === s.id} onClick={() => void cancel(s.id)}>
                {busy === s.id && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                {say("أنهِ السلسلة", "End series")}
              </button>
            ) : (
              <StatusChip tone="muted">{say("منتهية", "Ended")}</StatusChip>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
