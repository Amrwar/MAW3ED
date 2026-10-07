"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import Alert from "@/components/ui/Alert";
import { AdminTable, Pill, when } from "../../_components/AdminBits";
import { formatCents } from "@/lib/payments/money";
import type {
  PaymentKind,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Plan,
} from "@prisma/client";

export interface AdminPaymentRow {
  id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  provider: PaymentProvider;
  method: PaymentMethod | null;
  amountCents: number;
  refundedCents: number;
  currency: string;
  plan: Plan | null;
  receiptNumber: string | null;
  providerTransactionId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  businessName: string;
  businessSlug: string;
  bookingRef: string | null;
  refunds: {
    id: string;
    amountCents: number;
    reason: string;
    actorName: string;
    createdAt: string;
  }[];
}

const KIND_AR: Record<PaymentKind, string> = {
  BOOKING_DEPOSIT: "عربون",
  BOOKING_BALANCE: "باقي الحساب",
  BOOKING_FULL: "دفع كامل",
  SUBSCRIPTION: "اشتراك",
};

const STATUS_AR: Record<PaymentStatus, { ar: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  PENDING: { ar: "قيد الدفع", tone: "warn" },
  SUCCEEDED: { ar: "تم", tone: "ok" },
  FAILED: { ar: "فشلت", tone: "danger" },
  REFUNDED: { ar: "مُسترجَعة", tone: "muted" },
  PARTIALLY_REFUNDED: { ar: "استرجاع جزئي", tone: "warn" },
  ABANDONED: { ar: "متروكة", tone: "muted" },
};

const METHOD_AR: Record<PaymentMethod, string> = {
  CARD: "كارت",
  WALLET: "محفظة",
  CASH: "كاش",
  OTHER: "أخرى",
};

/**
 * The payments table, and the one control that moves money.
 *
 * The refund button is hidden from a role that cannot use it, but that
 * is a courtesy: the route checks payments.refund itself and answers
 * 404. Hiding a control has never stopped anybody who can type a URL.
 */
export default function PaymentsClient({
  rows,
  canRefund,
}: {
  rows: AdminPaymentRow[];
  canRefund: boolean;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<AdminPaymentRow | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundable = (p: AdminPaymentRow) =>
    canRefund &&
    (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") &&
    p.amountCents - p.refundedCents > 0;

  async function submitRefund() {
    if (!asking) return;
    setBusy(true);
    setError(null);
    try {
      const remaining = asking.amountCents - asking.refundedCents;
      // Typed in pounds because that is how a human thinks about it;
      // sent in piastres because that is what everything else counts in.
      const asked = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
      if (asked !== undefined && (!Number.isFinite(asked) || asked <= 0 || asked > remaining)) {
        setError(`المبلغ لازم يكون بين 0 و ${formatCents(remaining, asking.currency)}`);
        return;
      }

      const res = await fetch(`/api/admin/payments/${asking.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), ...(asked ? { amountCents: asked } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "تعذّر تنفيذ الاسترجاع");
        return;
      }
      setAsking(null);
      setReason("");
      setAmount("");
      router.refresh();
    } catch {
      setError("تعذّر الاتصال");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && !asking && <Alert tone="danger">{error}</Alert>}

      <AdminTable
        head={["الإيصال", "النشاط", "النوع", "المبلغ", "الطريقة", "الحالة", "الوقت", ""]}
        rows={rows.map((p) => {
          const remaining = p.amountCents - p.refundedCents;
          return [
            <span key="r" className="text-[0.6875rem]" dir="ltr">
              {p.receiptNumber ?? (
                <span className="text-[var(--color-faint)]">{p.bookingRef ?? "—"}</span>
              )}
            </span>,
            <span key="b" className="text-[0.78125rem]">{p.businessName}</span>,
            <span key="k" className="text-[0.75rem] text-[var(--color-muted)]">
              {KIND_AR[p.kind]}
              {p.plan ? ` · ${p.plan}` : ""}
            </span>,
            <span key="a" className="num whitespace-nowrap">
              {formatCents(p.amountCents, p.currency)}
              {p.refundedCents > 0 && (
                <span className="block text-[0.6875rem] text-[var(--color-danger)]">
                  − {formatCents(p.refundedCents, p.currency)}
                </span>
              )}
            </span>,
            <span key="m" className="text-[0.6875rem] text-[var(--color-subtle)]">
              {p.provider === "MANUAL" ? "يدوي" : "Paymob"}
              {p.method ? ` · ${METHOD_AR[p.method]}` : ""}
            </span>,
            <span key="s">
              <Pill tone={STATUS_AR[p.status].tone}>{STATUS_AR[p.status].ar}</Pill>
              {p.failureReason && (
                <span className="mt-1 block text-[0.625rem] text-[var(--color-danger)]">
                  {p.failureReason}
                </span>
              )}
            </span>,
            <span key="w" className="num whitespace-nowrap text-[0.75rem] text-[var(--color-subtle)]">
              {when(p.paidAt ?? p.createdAt)}
            </span>,
            <span key="x">
              {refundable(p) ? (
                <button
                  type="button"
                  onClick={() => {
                    setAsking(p);
                    setReason("");
                    setAmount("");
                    setError(null);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--color-danger)] px-3 text-[0.75rem] font-bold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
                >
                  <RotateCcw size={11} aria-hidden="true" />
                  استرجاع
                </button>
              ) : p.refundedCents > 0 && remaining === 0 ? (
                <span className="text-[0.6875rem] text-[var(--color-faint)]">مُسترجَعة</span>
              ) : null}
            </span>,
          ];
        })}
        empty="لسه مفيش عمليات دفع."
      />

      {/* ── Refund ── */}
      {asking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="استرجاع دفعة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitRefund();
            }}
            className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-raised)]"
          >
            <h2 className="m-0 mb-1 text-[0.9375rem] font-bold text-[var(--color-ink)]">
              استرجاع دفعة
            </h2>
            <p className="m-0 mb-4 text-[0.78125rem] text-[var(--color-subtle)]">
              {asking.businessName} · {formatCents(asking.amountCents, asking.currency)}
              {asking.refundedCents > 0 && (
                <> · المتبقي {formatCents(asking.amountCents - asking.refundedCents, asking.currency)}</>
              )}
            </p>

            {error && (
              <div className="mb-3">
                <Alert tone="danger">{error}</Alert>
              </div>
            )}

            <label
              htmlFor="refund-amount"
              className="mb-1.5 block text-[0.75rem] font-bold text-[var(--color-subtle)]"
            >
              المبلغ بالجنيه — سيبه فاضي عشان ترجّع المتبقي كله
            </label>
            <input
              id="refund-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              dir="ltr"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String((asking.amountCents - asking.refundedCents) / 100)}
              className="mb-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-[0.8125rem] outline-none focus:border-[var(--color-jade)]"
            />

            <label
              htmlFor="refund-reason"
              className="mb-1.5 block text-[0.75rem] font-bold text-[var(--color-subtle)]"
            >
              السبب — بيتسجّل في سجل التدقيق
            </label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              required
              minLength={3}
              maxLength={500}
              autoFocus
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 text-[0.8125rem] outline-none focus:border-[var(--color-jade)]"
            />

            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={busy || reason.trim().length < 3}
                className="btn btn-primary btn-sm"
              >
                {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                تأكيد الاسترجاع
              </button>
              <button
                type="button"
                onClick={() => {
                  setAsking(null);
                  setError(null);
                }}
                className="btn btn-ghost btn-sm"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
