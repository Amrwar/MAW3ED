import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, Tiles, day } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("subscriptions.read", "الاشتراكات");

export default async function AdminSubscriptionsPage() {
  await requireAdminPage("subscriptions.read");

  const [businesses, byPlan] = await Promise.all([
    db.business.findMany({
      orderBy: { currentPeriodEnd: "asc" },
      select: {
        id: true, nameAr: true, plan: true, subscriptionStatus: true,
        trialEndsAt: true, currentPeriodEnd: true, pendingPlan: true,
      },
    }),
    db.business.groupBy({ by: ["plan"], _count: { _all: true } }),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const expiringSoon = businesses.filter(
    (b) => b.currentPeriodEnd && b.currentPeriodEnd.getTime() - now < 7 * 86_400_000 && b.currentPeriodEnd.getTime() > now,
  ).length;
  const lapsed = businesses.filter(
    (b) => b.currentPeriodEnd && b.currentPeriodEnd.getTime() < now,
  ).length;

  return (
    <div>
      <AdminHeading title="الاشتراكات" subtitle="من الباقات المسجّلة على الأعمال نفسها." />

      <Tiles
        items={[
          ...byPlan.map((p) => ({ label: `باقة ${p.plan}`, value: String(p._count._all) })),
          { label: "بتنتهي خلال أسبوع", value: String(expiringSoon) },
          { label: "منتهية", value: String(lapsed) },
        ]}
      />

      <AdminTable
        head={["النشاط", "الباقة", "الحالة", "تجربة لحد", "الفترة لحد", "باقة منتظرة"]}
        rows={businesses.map((b) => [
          <span key="n" className="font-bold text-[var(--color-ink)]">{b.nameAr}</span>,
          <Pill key="p" tone={b.plan === "FREE" ? "muted" : "ok"}>{b.plan}</Pill>,
          <Pill key="s" tone={b.subscriptionStatus === "ACTIVE" ? "ok" : "warn"}>
            {b.subscriptionStatus}
          </Pill>,
          <span key="t" className="num whitespace-nowrap text-[0.75rem]">{day(b.trialEndsAt)}</span>,
          <span key="e" className="num whitespace-nowrap text-[0.75rem]">{day(b.currentPeriodEnd)}</span>,
          <span key="q" className="text-[0.75rem]">{b.pendingPlan ?? "—"}</span>,
        ])}
        empty="مفيش اشتراكات."
      />

      <p className="mt-4 text-[0.75rem] leading-relaxed text-[var(--color-subtle)]">
        الباقات بتتغيّر من خلال الدفع نفسه — مفيش هنا زرار بيرفّع نشاط لباقة من غير ما يدفع،
        عشان ده كان هيبقى تغيير مالي مالوش أثر في أي مكان تاني.
      </p>
    </div>
  );
}
