import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("businesses.verify", "التوثيق");

/**
 * Who carries the badge, on what evidence, and what each business has
 * confirmed about itself.
 *
 * The badge means Maw3ed checked the owner's identity or ownership, and
 * only an administrator grants it — from the Businesses page, with a
 * note of what was checked. Confirming an email or a phone is shown
 * here beside it, separately, because those prove only that the owner
 * can be reached.
 */
export default async function AdminVerificationPage() {
  await requireAdminPage("businesses.verify");

  const businesses = await db.business.findMany({
    orderBy: [{ isVerified: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nameAr: true,
      isVerified: true,
      identityVerifiedAt: true,
      identityVerificationNote: true,
      owner: { select: { emailVerified: true, phoneVerifiedAt: true } },
    },
  });

  return (
    <div>
      <AdminHeading
        title="التوثيق"
        subtitle="الشارة معناها إن موعد اتأكد من صاحب النشاط بمستندات. بتتمنح من صفحة الأعمال مع ملاحظة بالمراجعة. تأكيد الإيميل والتليفون لوحده مش توثيق."
      />
      <AdminTable
        head={["النشاط", "الشارة", "تاريخ التوثيق", "اللي اتراجع", "إيميل المالك", "موبايل المالك"]}
        rows={businesses.map((b) => [
          <Link key="n" href={`/admin/businesses?q=${encodeURIComponent(b.nameAr)}`} className="font-bold text-[var(--color-ink)] hover:underline">
            {b.nameAr}
          </Link>,
          b.isVerified ? <Pill key="v" tone="ok">موثّق</Pill> : <Pill key="v">لأ</Pill>,
          <span key="d" className="num">
            {b.identityVerifiedAt ? b.identityVerifiedAt.toISOString().slice(0, 10) : "—"}
          </span>,
          <span key="note" className="text-xs">{b.identityVerificationNote ?? "—"}</span>,
          b.owner.emailVerified ? <Pill key="e" tone="ok">✓</Pill> : <Pill key="e" tone="warn">لأ</Pill>,
          b.owner.phoneVerifiedAt ? <Pill key="p" tone="ok">✓</Pill> : <Pill key="p" tone="warn">لأ</Pill>,
        ])}
        empty="مفيش أعمال."
      />
    </div>
  );
}
