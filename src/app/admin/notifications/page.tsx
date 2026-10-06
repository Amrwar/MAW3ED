import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, Tiles, when } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("notifications.read", "الإشعارات");

/** The delivery ledger: what went out, on which channel, and what happened. */
export default async function AdminNotificationsPage() {
  await requireAdminPage("notifications.read");

  const [recent, byStatus, byChannel] = await Promise.all([
    db.notificationDelivery.findMany({ orderBy: { createdAt: "desc" }, take: 150 }),
    db.notificationDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
    db.notificationDelivery.groupBy({ by: ["channel"], _count: { _all: true } }),
  ]);

  const failed = byStatus.find((s) => s.status === "FAILED")?._count._all ?? 0;

  return (
    <div>
      <AdminHeading
        title="الإشعارات"
        subtitle="سجل الإرسال. كل صف بيقول راح لمين وعلى أنهي قناة وحصل إيه."
      />

      <Tiles
        items={[
          ...byChannel.map((c) => ({ label: c.channel, value: String(c._count._all) })),
          { label: "فشل", value: String(failed) },
        ]}
      />

      <AdminTable
        head={["النوع", "القناة", "الحالة", "المستقبل", "السبب", "الوقت"]}
        rows={recent.map((d) => [
          <code key="k" className="text-[0.625rem]" dir="ltr">{d.kind}</code>,
          <Pill key="c">{d.channel}</Pill>,
          <Pill key="s" tone={d.status === "SENT" ? "ok" : d.status === "FAILED" ? "danger" : "muted"}>
            {d.status}
          </Pill>,
          <span key="r" className="text-[0.6875rem] text-[var(--color-subtle)]" dir="ltr">
            {d.recipient.length > 28 ? d.recipient.slice(0, 28) + "…" : d.recipient}
          </span>,
          <span key="e" className="text-[0.6875rem] text-[var(--color-subtle)]">{d.error ?? "—"}</span>,
          <span key="w" className="num whitespace-nowrap text-[0.75rem] text-[var(--color-subtle)]">{when(d.createdAt)}</span>,
        ])}
        empty="لسه مفيش إشعارات اتبعتت."
      />
    </div>
  );
}
