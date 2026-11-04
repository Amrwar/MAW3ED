import { db } from "@/lib/db";

/**
 * Payment reconciliation (Phase 28, docs/enterprise/OPERATIONS_RUNBOOK.md):
 * totals per provider and kind for a period, and every payment whose own
 * ledger does not add up. Read-only — it reports, a person decides.
 *
 * Checks, each a class of discrepancy:
 *   refund-sum      refundedCents differs from the sum of its SUCCEEDED refunds
 *   status          the status contradicts the amounts (REFUNDED but not all
 *                   refunded, PARTIALLY_REFUNDED with nothing or everything
 *                   refunded, SUCCEEDED with money refunded)
 *   over-refunded   refunded more than was paid
 *   no-receipt      money arrived but no receipt number was given
 *   held-but-paid   a deposit succeeded but its booking still waits for it
 */

export type Discrepancy = { paymentId: string; check: "refund-sum" | "status" | "over-refunded" | "no-receipt" | "held-but-paid"; detail: string };

export interface PaymentRow {
  id: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  receiptNumber: string | null;
  refundsSucceededCents: number;
  bookingStatus: string | null;
  kind: string;
}

/** Pure: what is wrong with one payment, if anything. */
export function checkPayment(p: PaymentRow): Discrepancy[] {
  const out: Discrepancy[] = [];
  const paidStates = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"];
  if (paidStates.includes(p.status) && p.refundedCents !== p.refundsSucceededCents) {
    out.push({ paymentId: p.id, check: "refund-sum", detail: `refundedCents ${p.refundedCents} vs refunds ${p.refundsSucceededCents}` });
  }
  if (p.refundedCents > p.amountCents) out.push({ paymentId: p.id, check: "over-refunded", detail: `${p.refundedCents} > ${p.amountCents}` });
  if (p.status === "REFUNDED" && p.refundedCents < p.amountCents) out.push({ paymentId: p.id, check: "status", detail: "REFUNDED but not fully refunded" });
  if (p.status === "PARTIALLY_REFUNDED" && (p.refundedCents <= 0 || p.refundedCents >= p.amountCents)) out.push({ paymentId: p.id, check: "status", detail: "PARTIALLY_REFUNDED with nothing or everything refunded" });
  if (p.status === "SUCCEEDED" && p.refundedCents > 0) out.push({ paymentId: p.id, check: "status", detail: "SUCCEEDED but money was refunded" });
  if (paidStates.includes(p.status) && !p.receiptNumber) out.push({ paymentId: p.id, check: "no-receipt", detail: "paid without a receipt number" });
  if (p.kind === "BOOKING_DEPOSIT" && paidStates.includes(p.status) && p.bookingStatus === "PENDING_PAYMENT") {
    out.push({ paymentId: p.id, check: "held-but-paid", detail: "deposit paid; booking still PENDING_PAYMENT" });
  }
  return out;
}

export async function reconcilePayments(from: Date, to: Date, limit = 5_000) {
  const rows = await db.payment.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: {
      id: true, kind: true, provider: true, status: true, amountCents: true, refundedCents: true, receiptNumber: true,
      booking: { select: { status: true } },
      refunds: { where: { status: "SUCCEEDED" }, select: { amountCents: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const totals = new Map<string, { provider: string; kind: string; count: number; grossCents: number; refundedCents: number; netCents: number }>();
  const discrepancies: Discrepancy[] = [];
  for (const p of rows) {
    const paid = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status);
    if (paid) {
      const key = `${p.provider}|${p.kind}`;
      const t = totals.get(key) ?? { provider: p.provider, kind: p.kind, count: 0, grossCents: 0, refundedCents: 0, netCents: 0 };
      t.count++;
      t.grossCents += p.amountCents;
      t.refundedCents += p.refundedCents;
      t.netCents += p.amountCents - p.refundedCents;
      totals.set(key, t);
    }
    discrepancies.push(...checkPayment({
      id: p.id, status: p.status, amountCents: p.amountCents, refundedCents: p.refundedCents, receiptNumber: p.receiptNumber,
      refundsSucceededCents: p.refunds.reduce((s, r) => s + r.amountCents, 0), bookingStatus: p.booking?.status ?? null, kind: p.kind,
    }));
  }
  return { from: from.toISOString(), to: to.toISOString(), scanned: rows.length, truncated: rows.length === limit, totals: [...totals.values()], discrepancies };
}
