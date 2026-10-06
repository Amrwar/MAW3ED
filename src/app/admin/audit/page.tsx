import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, when } from "../_components/AdminBits";
import AuditFilters from "./_components/AuditFilters";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("audit.read", "سجل النشاط");

/**
 * Who did what.
 *
 * Read-only by construction: there is no edit and no delete here, and
 * nothing in the application writes to a row after creating it.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage("audit.read");
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const action = one("action");
  const resource = one("resource");

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { startsWith: action } } : {}),
    ...(resource ? { resourceType: resource } : {}),
  };

  const [entries, actions, resources] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 200 }),
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
    db.auditLog.groupBy({ by: ["resourceType"], _count: { _all: true } }),
  ]);

  return (
    <div>
      <AdminHeading
        title="سجل النشاط"
        subtitle="كل إجراء إداري بيتسجّل هنا. مفيش تعديل ومفيش حذف."
      />

      <AuditFilters
        action={action ?? ""}
        resource={resource ?? ""}
        actions={actions.map((a) => ({ id: a.action, n: a._count._all }))}
        resources={resources.map((r) => ({ id: r.resourceType, n: r._count._all }))}
      />

      <AdminTable
        head={["الوقت", "مين", "الإجراء", "على إيه", "إيه اللي حصل"]}
        rows={entries.map((e) => [
          <span key="t" className="num whitespace-nowrap text-[var(--color-subtle)]">{when(e.at)}</span>,
          <span key="w" className="whitespace-nowrap">
            {e.actorName ?? "النظام"}
            {e.actorRole ? <> <Pill>{e.actorRole}</Pill></> : null}
          </span>,
          <code key="a" className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[0.6875rem]" dir="ltr">
            {e.action}
          </code>,
          <span key="r" className="text-[0.75rem] text-[var(--color-subtle)]" dir="ltr">
            {e.resourceType}
            {e.resourceId ? `/${e.resourceId.slice(0, 8)}` : ""}
          </span>,
          <span key="s">{e.summary}</span>,
        ])}
        empty="لسه مفيش نشاط مسجّل."
      />

      {entries.length === 200 && (
        <p className="num mt-3 text-center text-[0.75rem] text-[var(--color-faint)]">
          بتعرض آخر 200 إدخال
        </p>
      )}
    </div>
  );
}
