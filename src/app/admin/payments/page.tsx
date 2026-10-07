import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, Tiles } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";
import { can } from "@/lib/admin/permissions";
import { formatCents } from "@/lib/payments/money";
import PaymentsClient, { type AdminPaymentRow } from "./_components/PaymentsClient";

export const generateMetadata = adminMetadata("payments.read", "المدفوعات");

/**
 * The money, as the ledger records it.
 *
 * This page used to read Booking rows and show the two Paymob ids
 * stored on them, and said so deliberately: "a ledger would be a second
 * accounting of money the provider already accounts for." That was a
 * fair call while the only question was whether a deposit had landed.
 * It stopped being one once the answer had to cover a balance paid
 * later, money taken at the counter, a refund, a receipt number a
 * customer can quote, and an attempt that failed — none of which Paymob
 * accounts for on our behalf, and none of which fits in two columns.
 */
export default async function AdminPaymentsPage() {
  const admin = await requireAdminPage("payments.read");

  const [payments, totals, refundedAgg, failedCount] = await Promise.all([
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        kind: true,
        status: true,
        provider: true,
        method: true,
        amountCents: true,
        refundedCents: true,
        currency: true,
        plan: true,
        receiptNumber: true,
        providerTransactionId: true,
        paidAt: true,
        failureReason: true,
        createdAt: true,
        business: { select: { nameAr: true, slug: true } },
        booking: { select: { reference: true, id: true } },
        refunds: {
          where: { status: "SUCCEEDED" },
          orderBy: { createdAt: "desc" },
          select: { id: true, amountCents: true, reason: true, actorName: true, createdAt: true },
        },
      },
    }),
    db.payment.aggregate({
      where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] } },
      _sum: { amountCents: true, refundedCents: true },
      _count: { _all: true },
    }),
    db.refund.aggregate({ where: { status: "SUCCEEDED" }, _count: { _all: true } }),
    db.payment.count({ where: { status: "FAILED" } }),
  ]);

  const collected = totals._sum.amountCents ?? 0;
  const refunded = totals._sum.refundedCents ?? 0;

  const rows: AdminPaymentRow[] = payments.map((p) => ({
    id: p.id,
    kind: p.kind,
    status: p.status,
    provider: p.provider,
    method: p.method,
    amountCents: p.amountCents,
    refundedCents: p.refundedCents,
    currency: p.currency,
    plan: p.plan,
    receiptNumber: p.receiptNumber,
    providerTransactionId: p.providerTransactionId,
    failureReason: p.failureReason,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    businessName: p.business.nameAr,
    businessSlug: p.business.slug,
    bookingRef: p.booking?.reference ?? p.booking?.id.slice(0, 8) ?? null,
    refunds: p.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      reason: r.reason,
      actorName: r.actorName,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      <AdminHeading
        title="المدفوعات"
        subtitle="كل عملية دفع، ناجحة أو فاشلة، وكل استرجاع. موعد مش بيشوف كارت ولا بيخزّن واحد."
      />

      <Tiles
        items={[
          {
            label: "المُحصّل",
            value: formatCents(collected - refunded),
            hint: `${totals._count._all} عملية`,
          },
          {
            label: "المُسترجَع",
            value: formatCents(refunded),
            hint: `${refundedAgg._count._all} استرجاع`,
          },
          { label: "دفعات فشلت", value: String(failedCount) },
        ]}
      />

      <PaymentsClient rows={rows} canRefund={can(admin.role, "payments.refund")} />
    </div>
  );
}
