import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { money } from "@/lib/fmt";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("catalogue.read", "الخدمات");

export default async function AdminServicesPage() {
  await requireAdminPage("catalogue.read");

  const services = await db.service.findMany({
    orderBy: [{ businessId: "asc" }, { sortOrder: "asc" }],
    take: 300,
    select: {
      id: true, nameAr: true, duration: true, price: true, currency: true,
      isAvailable: true,
      business: { select: { nameAr: true } },
      _count: { select: { bookings: true } },
    },
  });

  return (
    <div>
      <AdminHeading
        title="الخدمات"
        subtitle={`${services.length} خدمة عبر كل الأعمال.`}
      />
      <AdminTable
        head={["الخدمة", "النشاط", "المدة", "السعر", "حجوزات", "متاحة"]}
        rows={services.map((s) => [
          <span key="n" className="font-bold text-[var(--color-ink)]">{s.nameAr}</span>,
          <span key="b" className="text-[0.78125rem]">{s.business.nameAr}</span>,
          <span key="d" className="num">{s.duration} د</span>,
          <span key="p" className="num whitespace-nowrap">
            {Number(s.price) > 0 ? money(Number(s.price), "ar", s.currency) : "—"}
          </span>,
          <span key="c" className="num">{s._count.bookings}</span>,
          s.isAvailable ? <Pill key="a" tone="ok">متاحة</Pill> : <Pill key="a">موقوفة</Pill>,
        ])}
        empty="مفيش خدمات."
      />
    </div>
  );
}
