import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, when } from "../_components/AdminBits";
import { ROLE_LABELS } from "@/lib/admin/permissions";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("settings.manage", "إعدادات النظام");

/**
 * Who administers the platform, and what is configured.
 *
 * Roles are read-only here on purpose. Granting one from a screen means
 * the screen is an escalation path, and this panel's whole access model
 * rests on the role living only in the database. Changing it is a
 * deliberate act at the database, not a click.
 */
export default async function AdminSettingsPage() {
  await requireAdminPage("settings.manage");

  const admins = await db.user.findMany({
    where: { adminRole: { not: null } },
    orderBy: { adminRole: "desc" },
    select: { id: true, name: true, email: true, adminRole: true, createdAt: true },
  });

  const configured = [
    { key: "WHATSAPP_ACCESS_TOKEN", label: "واتساب" },
    { key: "RESEND_API_KEY", label: "البريد" },
    { key: "SMS_API_KEY", label: "SMS" },
    { key: "PAYMOB_API_KEY", label: "الدفع" },
    { key: "CLOUDINARY_API_KEY", label: "الصور" },
    { key: "CRON_SECRET", label: "المهام المجدولة" },
    { key: "NEXT_PUBLIC_SENTRY_DSN", label: "تتبّع الأخطاء" },
  ].map((x) => ({ ...x, on: Boolean(process.env[x.key]) }));

  return (
    <div>
      <AdminHeading title="إعدادات النظام" subtitle="مين بيدير المنصة، وإيه اللي متظبّط." />

      <h2 className="m-0 mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">المشرفون</h2>
      <AdminTable
        head={["الاسم", "الإيميل", "الدور", "الحساب من"]}
        rows={admins.map((a) => [
          <span key="n" className="font-bold text-[var(--color-ink)]">{a.name ?? "—"}</span>,
          <span key="e" className="text-[0.78125rem]" dir="ltr">{a.email ?? "—"}</span>,
          <Pill key="r" tone="ok">{a.adminRole ? ROLE_LABELS[a.adminRole].ar : "—"}</Pill>,
          <span key="w" className="num whitespace-nowrap text-[0.75rem] text-[var(--color-subtle)]">{when(a.createdAt)}</span>,
        ])}
        empty="مفيش مشرفين."
      />

      <p className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3.5 text-[0.78125rem] leading-relaxed text-[var(--color-muted)]">
        الأدوار بتتظبّط في قاعدة البيانات مباشرة، مش من هنا. لو الشاشة دي تقدر تمنح دور،
        تبقى هي نفسها طريق للتصعيد — واللوحة كلها قايمة على إن الدور مش ممكن يتمنح من
        جوه التطبيق.
      </p>

      <h2 className="m-0 mb-3 mt-7 text-[0.9375rem] font-bold text-[var(--color-ink)]">
        الخدمات الخارجية
      </h2>
      <AdminTable
        head={["الخدمة", "الحالة"]}
        rows={configured.map((c) => [
          <span key="l">{c.label} <code className="ms-2 text-[0.625rem] text-[var(--color-faint)]" dir="ltr">{c.key}</code></span>,
          c.on ? <Pill key="s" tone="ok">متظبّطة</Pill> : <Pill key="s" tone="warn">مش متظبّطة</Pill>,
        ])}
        empty=""
      />
    </div>
  );
}
