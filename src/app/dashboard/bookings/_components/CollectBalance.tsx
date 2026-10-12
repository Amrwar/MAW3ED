"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Wallet } from "lucide-react";
import { formatCents } from "@/lib/payments/money";

interface LedgerLine {
  id: string;
  kind: string;
  status: string;
  provider: string;
  method: string | null;
  amountCents: number;
  refundedCents: number;
  receiptNumber: string | null;
  paidAt: string | null;
}

interface Summary {
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  currency: string;
  payments: LedgerLine[];
}

const KIND_AR: Record<string, string> = {
  BOOKING_DEPOSIT: "عربون",
  BOOKING_BALANCE: "باقي الحساب",
  BOOKING_FULL: "دفع كامل",
};

/**
 * What is still owed on a booking, and the two ways to collect it.
 *
 * The deposit was taken at booking time and the rest was never
 * collectable at all — there was no second payment a booking could
 * hold. Both routes land in the same ledger: a link the customer pays
 * through Paymob, or money that changed hands at the counter, which is
 * how most of this actually happens.
 *
 * Amounts are read from the server, never computed here. The route
 * works out what is outstanding from the price and the ledger, and
 * refuses anything above it, so a stale panel cannot over-collect.
 */
export default function CollectBalance({ bookingId }: { bookingId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"link" | "manual" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/business/bookings/${bookingId}/payments`);
      if (!res.ok) {
        setSummary(null);
        return;
      }
      const data = await res.json();
      setSummary(data.data ?? data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setLink(null);
    setError(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  async function collect(mode: "link" | "manual", method?: "CASH" | "CARD") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/business/bookings/${bookingId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...(method ? { method } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "تعذّر تنفيذ العملية");
        return;
      }
      if (mode === "link") setLink((data.data ?? data).paymentUrl ?? null);
      await load();
    } catch {
      setError("تعذّر الاتصال");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <p className="m-0 flex items-center gap-2 text-[0.8125rem] text-[var(--color-subtle)]">
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        بنحمّل حالة الدفع…
      </p>
    );
  }

  if (!summary) return null;

  const settled = summary.outstandingCents === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
        <span className="text-[var(--color-muted)]">المدفوع</span>
        <span className="num font-bold text-[var(--color-ink)]">
          {formatCents(summary.paidCents, summary.currency)} / {formatCents(summary.totalCents, summary.currency)}
        </span>
      </div>

      {!settled && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
          <span className="text-[var(--color-muted)]">المتبقي</span>
          <span className="num font-bold text-[var(--color-warn)]">
            {formatCents(summary.outstandingCents, summary.currency)}
          </span>
        </div>
      )}

      {summary.payments.length > 0 && (
        <ul className="m-0 list-none space-y-1 p-0">
          {summary.payments
            .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
            .map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 text-[0.75rem] text-[var(--color-subtle)]"
              >
                <span>
                  {KIND_AR[p.kind] ?? p.kind}
                  {p.provider === "MANUAL" ? " · يدوي" : ""}
                  {p.receiptNumber && (
                    <span className="num ms-1.5 text-[var(--color-subtle)]" dir="ltr">
                      {p.receiptNumber}
                    </span>
                  )}
                </span>
                <span className="num">{formatCents(p.amountCents, summary.currency)}</span>
              </li>
            ))}
        </ul>
      )}

      {error && (
        <p className="m-0 rounded-[var(--radius-sm)] bg-[var(--color-danger-soft)] px-3 py-2 text-[0.75rem] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      {settled ? (
        <p className="m-0 flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--color-ok)]">
          <Check size={14} aria-hidden="true" />
          الحجز مدفوع بالكامل
        </p>
      ) : link ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-jade)] bg-[var(--color-jade-tint)] p-3">
          <p className="m-0 mb-2 text-[0.75rem] font-bold text-[var(--color-jade)]">
            ابعت الرابط ده للعميل
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              dir="ltr"
              aria-label="رابط الدفع"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[0.6875rem]"
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="btn btn-outline btn-sm shrink-0"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? "اتنسخ" : "نسخ"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void collect("link")}
            disabled={busy !== null}
            className="btn btn-outline btn-sm"
          >
            {busy === "link" ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Link2 size={13} aria-hidden="true" />
            )}
            رابط دفع
          </button>
          <button
            type="button"
            onClick={() => void collect("manual", "CASH")}
            disabled={busy !== null}
            className="btn btn-outline btn-sm"
          >
            {busy === "manual" ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Wallet size={13} aria-hidden="true" />
            )}
            اتدفع كاش
          </button>
        </div>
      )}
    </div>
  );
}
