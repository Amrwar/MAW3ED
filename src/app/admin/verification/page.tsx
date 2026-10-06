import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("businesses.verify", "التوثيق");

/**
 * Who has earned the badge, and who is short of what.
 *
 * Verification is earned, not granted: a business needs a verified
 * email, a verified phone, services and a filled-in profile. This
 * shows which of those each business is missing rather than offering a
 * button that would make the badge mean nothing.
 */
export default async function AdminVerificationPage() {
  await requireAdminPage("businesses.verify");

  const businesses = await db.business.findMany({
    orderBy: [{ isVerified: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, nameAr: true, isVerified: true, about: true, logoImage: true,
      phone: true, whatsapp: true,
      owner: { select: { emailVerified: true, phoneVerifiedAt: true } },
      _count: { select: { services: true } },
    },
  });

  return (
    <div>
      <AdminHeading
        title="التوثيق"
        subtitle="الشارة بتتكسب مش بتتمنح — الجدول بيقول كل نشاط ناقصه إيه."
      />
      <AdminTable
        head={["النشاط", "الشارة", "إيميل المالك", "موبايل المالك", "خدمات", "ملف مكتمل"]}
        rows={businesses.map((b) => {
          const profile = Boolean(b.about?.trim() && b.logoImage && (b.phone || b.whatsapp));
          return [
            <span key="n" className="font-bold text-[var(--color-ink)]">{b.nameAr}</span>,
            b.isVerified ? <Pill key="v" tone="ok">موثّق</Pill> : <Pill key="v">لأ</Pill>,
            b.owner.emailVerified ? <Pill key="e" tone="ok">✓</Pill> : <Pill key="e" tone="warn">ناقص</Pill>,
            b.owner.phoneVerifiedAt ? <Pill key="p" tone="ok">✓</Pill> : <Pill key="p" tone="warn">ناقص</Pill>,
            <span key="s" className="num">{b._count.services}</span>,
            profile ? <Pill key="f" tone="ok">✓</Pill> : <Pill key="f" tone="warn">ناقص</Pill>,
          ];
        })}
        empty="مفيش أعمال."
      />
    </div>
  );
}
