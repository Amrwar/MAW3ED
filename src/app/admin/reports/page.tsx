import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Tiles } from "../_components/AdminBits";
import { money } from "@/lib/fmt";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("reports.read", "التقارير");

/**
 * The platform's own numbers, counted the same way the business
 * dashboard counts a single business: a visit is a COMPLETED booking,
 * revenue is COMPLETED only, and abandoned checkouts are nowhere.
 */
export default async function AdminReportsPage() {
  await requireAdminPage("reports.read");

  // One clock read per request. This is a server component, so there is
  // no re-render for the value to drift across.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [statuses, completed, newBusinesses, newCustomers, topBusinesses] = await Promise.all([
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.booking.aggregate({
      where: { status: "COMPLETED" },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
    db.business.count({ where: { createdAt: { gte: since } } }),
    db.customer.count({ where: { createdAt: { gte: since } } }),
    db.business.findMany({
      orderBy: { bookings: { _count: "desc" } },
      take: 10,
      select: {
        nameAr: true,
        _count: { select: { bookings: true } },
        bookings: { where: { status: "COMPLETED" }, select: { totalPrice: true } },
      },
    }),
  ]);

  const tally = Object.fromEntries(statuses.map((s) => [s.status, s._count._all]));
  const live = (tally.PENDING ?? 0) + (tally.CONFIRMED ?? 0);

  return (
    <div>
      <AdminHeading
        title="التقارير"
        subtitle="كل رقم محسوب من الحجوزات نفسها. مفيش توقّعات ومفيش اتجاهات — العدد لسه صغير أوي على كده."
      />

      <Tiles
        items={[
          { label: "مواعيد تمّت", value: String(tally.COMPLETED ?? 0) },
          {
            label: "إيراد المواعيد اللي تمّت",
            value: money(Number(completed._sum.totalPrice ?? 0), "ar"),
          },
          { label: "حجوزات شغالة", value: String(live) },
          { label: "إلغاء / غياب", value: String((tally.CANCELLED ?? 0) + (tally.NO_SHOW ?? 0)) },
          { label: "أعمال جديدة", value: String(newBusinesses), hint: "آخر 30 يوم" },
          { label: "عملاء جدد", value: String(newCustomers), hint: "آخر 30 يوم" },
        ]}
      />

      <h2 className="m-0 mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">
        الأعمال حسب الحجوزات
      </h2>
      <AdminTable
        head={["النشاط", "كل الحجوزات", "إيراد المواعيد اللي تمّت"]}
        rows={topBusinesses.map((b) => [
          <span key="n" className="font-bold text-[var(--color-ink)]">{b.nameAr}</span>,
          <span key="c" className="num">{b._count.bookings}</span>,
          <span key="r" className="num whitespace-nowrap">
            {money(b.bookings.reduce((s, x) => s + Number(x.totalPrice), 0), "ar")}
          </span>,
        ])}
        empty="لسه مفيش حجوزات."
      />
    </div>
  );
}
