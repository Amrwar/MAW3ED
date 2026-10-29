import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill } from "../_components/AdminBits";
import { money, clock } from "@/lib/fmt";
import { adminMetadata } from "@/lib/admin/meta";
import LinkPager from "@/components/ui/LinkPager";
import { ADMIN_PAGER_LABELS, readPage } from "@/lib/admin/paging";

const PER_PAGE = 50;

export const generateMetadata = adminMetadata("bookings.read", "الحجوزات");

const TONE: Record<string, "ok" | "warn" | "danger" | "muted"> = {
  COMPLETED: "ok", CONFIRMED: "ok", ARRIVED: "ok", IN_PROGRESS: "ok",
  PENDING: "warn", PENDING_PAYMENT: "warn",
  CANCELLED: "danger", NO_SHOW: "danger", FAILED_PAYMENT: "danger",
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPage("bookings.read");

  const total = await db.booking.count();
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(readPage((await searchParams).page), totalPages);

  const [bookings, byStatus] = await Promise.all([
    db.booking.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
      select: {
        id: true, reference: true, status: true, date: true, startTime: true,
        totalPrice: true, currency: true, customerName: true, createdAt: true,
        business: { select: { nameAr: true } },
        service: { select: { nameAr: true } },
      },
    }),
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return (
    <div>
      <AdminHeading
        title="الحجوزات"
        subtitle={byStatus.map((s) => `${s.status}: ${s._count._all}`).join(" · ") || "لسه مفيش حجوزات"}
      />
      <AdminTable
        head={["المرجع", "النشاط", "العميل", "الخدمة", "الموعد", "القيمة", "الحالة"]}
        rows={bookings.map((b) => [
          <code key="r" className="text-[0.6875rem]" dir="ltr">{b.reference ?? b.id.slice(0, 8)}</code>,
          <span key="b" className="text-[0.78125rem]">{b.business.nameAr}</span>,
          <span key="c" className="text-[0.78125rem]">{b.customerName}</span>,
          <span key="s" className="text-[0.78125rem]">{b.service.nameAr}</span>,
          <span key="d" className="num whitespace-nowrap text-[0.75rem]">
            {b.date.toISOString().slice(0, 10)} {clock(b.startTime)}
          </span>,
          <span key="m" className="num whitespace-nowrap">{money(Number(b.totalPrice), "ar", b.currency)}</span>,
          <Pill key="p" tone={TONE[b.status] ?? "muted"}>{b.status}</Pill>,
        ])}
        empty="لسه مفيش حجوزات."
      />
      <LinkPager className="mt-5" page={page} totalPages={totalPages} basePath="/admin/bookings" labels={ADMIN_PAGER_LABELS} />
    </div>
  );
}
