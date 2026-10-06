import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, when } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("customers.read", "العملاء");

/**
 * Customers across the whole platform.
 *
 * A Customer row belongs to one business — the same person booking at
 * two places is two rows — so this lists records, not people, and says
 * so rather than implying a unified identity that does not exist.
 */
export default async function AdminCustomersPage() {
  await requireAdminPage("customers.read");

  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, name: true, phone: true, email: true, tags: true, createdAt: true,
      business: { select: { nameAr: true, slug: true } },
      bookings: { select: { status: true } },
    },
  });

  const accounts = await db.user.count({ where: { phoneVerifiedAt: { not: null } } });

  return (
    <div>
      <AdminHeading
        title="العملاء"
        subtitle={`${customers.length} سجل عميل · ${accounts} حساب عميل مفعّل برقم موبايل. السجل بيخص نشاط واحد — نفس الشخص في مكانين بيبقى سجلين.`}
      />
      <AdminTable
        head={["العميل", "النشاط", "حجوزات", "تمّت", "تصنيفات", "أول ظهور"]}
        rows={customers.map((c) => {
          const completed = c.bookings.filter((b) => b.status === "COMPLETED").length;
          return [
            <span key="c">
              <span className="font-bold text-[var(--color-ink)]">{c.name}</span>
              <span className="num block text-[0.75rem] text-[var(--color-subtle)]" dir="ltr">{c.phone}</span>
            </span>,
            <span key="b" className="text-[0.78125rem]">{c.business.nameAr}</span>,
            <span key="n" className="num">{c.bookings.length}</span>,
            <span key="d" className="num">{completed}</span>,
            <span key="t">{c.tags.length ? c.tags.map((t) => <Pill key={t}>{t}</Pill>) : "—"}</span>,
            <span key="w" className="num whitespace-nowrap text-[var(--color-subtle)]">{when(c.createdAt)}</span>,
          ];
        })}
        empty="لسه مفيش عملاء."
      />
    </div>
  );
}
