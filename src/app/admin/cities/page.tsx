import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("catalogue.read", "المدن");

export default async function AdminCitiesPage() {
  await requireAdminPage("catalogue.read");

  const cities = await db.city.findMany({
    orderBy: { nameAr: "asc" },
    select: {
      id: true, slug: true, nameAr: true, nameEn: true,
      _count: { select: { businesses: true, neighborhoods: true } },
    },
  });

  const used = cities.filter((c) => c._count.businesses > 0).length;

  return (
    <div>
      <AdminHeading
        title="المدن"
        subtitle={`${cities.length} مدينة، ${used} منها فيها أعمال.`}
      />
      <AdminTable
        head={["المدينة", "الرابط", "أعمال", "أحياء", "صفحة الهبوط"]}
        rows={cities.map((c) => [
          <span key="n">
            <span className="font-bold text-[var(--color-ink)]">{c.nameAr}</span>
            {c.nameEn && <span className="ms-2 text-[0.75rem] text-[var(--color-subtle)]" dir="ltr">{c.nameEn}</span>}
          </span>,
          <code key="s" className="text-[0.6875rem]" dir="ltr">{c.slug}</code>,
          <span key="b" className="num">{c._count.businesses}</span>,
          <span key="h" className="num">{c._count.neighborhoods}</span>,
          c._count.businesses > 0 ? (
            <Link key="l" href={`/cities/${c.slug}`} target="_blank" className="text-[0.75rem] font-bold text-[var(--color-jade)]">
              مفتوحة
            </Link>
          ) : (
            <Pill key="l">مفيش</Pill>
          ),
        ])}
        empty="مفيش مدن."
      />
    </div>
  );
}
