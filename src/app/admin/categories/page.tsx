import Link from "@/components/shared/LocaleLink";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("catalogue.read", "التصنيفات");

/** The catalogue, with how much of it is actually in use. */
export default async function AdminCategoriesPage() {
  await requireAdminPage("catalogue.read");

  const categories = await db.category.findMany({
    orderBy: { nameAr: "asc" },
    select: {
      id: true, slug: true, nameAr: true, nameEn: true, icon: true,
      _count: { select: { businesses: true } },
    },
  });

  const used = categories.filter((c) => c._count.businesses > 0).length;

  return (
    <div>
      <AdminHeading
        title="التصنيفات"
        subtitle={`${categories.length} تصنيف، ${used} منها فيه أعمال. التصنيف الفاضي مالوش صفحة هبوط ومش في الـsitemap.`}
      />
      <AdminTable
        head={["التصنيف", "الرابط", "أعمال", "صفحة الهبوط"]}
        rows={categories.map((c) => [
          <span key="n">
            {c.icon} <span className="font-bold text-[var(--color-ink)]">{c.nameAr}</span>
            {c.nameEn && <span className="ms-2 text-[0.75rem] text-[var(--color-subtle)]" dir="ltr">{c.nameEn}</span>}
          </span>,
          <code key="s" className="text-[0.6875rem]" dir="ltr">{c.slug}</code>,
          <span key="b" className="num">{c._count.businesses}</span>,
          c._count.businesses > 0 ? (
            <Link key="l" href={`/categories/${c.slug}`} target="_blank" className="text-[0.75rem] font-bold text-[var(--color-jade)]">
              مفتوحة
            </Link>
          ) : (
            <Pill key="l">مفيش</Pill>
          ),
        ])}
        empty="مفيش تصنيفات."
      />
    </div>
  );
}
