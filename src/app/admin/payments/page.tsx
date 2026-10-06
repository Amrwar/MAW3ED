import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, Tiles, when } from "../_components/AdminBits";
import { money } from "@/lib/fmt";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("payments.read", "المدفوعات");

/**
 * What Paymob recorded against bookings.
 *
 * Maw3ed never sees a card: a deposit is paid on the provider's hosted
 * page and what comes back is an order id and a transaction id. This
 * shows those, not a ledger, because a ledger would be a second
 * accounting of money the provider already accounts for.
 */
export default async function AdminPaymentsPage() {
  await requireAdminPage("payments.read");

  const [withPayment, failed, totals] = await Promise.all([
    db.booking.findMany({
      where: { OR: [{ paymobOrderId: { not: null } }, { paymobTransactionId: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true, reference: true, status: true, depositAmount: true, totalPrice: true,
        currency: true, paymobOrderId: true, paymobTransactionId: true, createdAt: true,
        business: { select: { nameAr: true } },
      },
    }),
    db.booking.count({ where: { status: "FAILED_PAYMENT" } }),
    db.booking.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
  ]);

  const settled = withPayment.filter((b) => b.paymobTransactionId).length;

  return (
    <div>
      <AdminHeading
        title="المدفوعات"
        subtitle="اللي سجّله Paymob على الحجوزات. موعد مش بيشوف كارت ولا بيخزّن واحد."
      />

      <Tiles
        items={[
          { label: "عمليات ناجحة", value: String(settled) },
          { label: "دفعات فشلت", value: String(failed) },
          {
            label: "إيراد المواعيد اللي تمّت",
            value: money(Number(totals._sum.totalPrice ?? 0), "ar"),
            hint: `${totals._count._all} موعد`,
          },
        ]}
      />

      <AdminTable
        head={["المرجع", "النشاط", "العربون", "الإجمالي", "Paymob", "الحالة", "الوقت"]}
        rows={withPayment.map((b) => [
          <code key="r" className="text-[0.6875rem]" dir="ltr">{b.reference ?? b.id.slice(0, 8)}</code>,
          <span key="b" className="text-[0.78125rem]">{b.business.nameAr}</span>,
          <span key="d" className="num whitespace-nowrap">
            {b.depositAmount ? money(Number(b.depositAmount), "ar", b.currency) : "—"}
          </span>,
          <span key="t" className="num whitespace-nowrap">{money(Number(b.totalPrice), "ar", b.currency)}</span>,
          <span key="p" className="text-[0.625rem] text-[var(--color-subtle)]" dir="ltr">
            {b.paymobTransactionId ? `tx ${b.paymobTransactionId}` : b.paymobOrderId ? `order ${b.paymobOrderId}` : "—"}
          </span>,
          <Pill key="s" tone={b.status === "FAILED_PAYMENT" ? "danger" : b.paymobTransactionId ? "ok" : "warn"}>
            {b.status}
          </Pill>,
          <span key="w" className="num whitespace-nowrap text-[0.75rem] text-[var(--color-subtle)]">{when(b.createdAt)}</span>,
        ])}
        empty="لسه مفيش عمليات دفع."
      />
    </div>
  );
}
