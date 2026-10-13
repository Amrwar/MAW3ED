import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/admin/guard";
import { can } from "@/lib/admin/permissions";
import { notFound } from "next/navigation";
import { AdminHeading, Tiles, AdminTable, Pill, when } from "./_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";
import { adminOverview } from "@/lib/admin/overview";

export const generateMetadata = adminMetadata("reviews.read", "نظرة عامة");

/**
 * The landing page.
 *
 * Every figure is counted from the database when the page loads, and
 * each block is behind the permission that owns it — a moderator sees
 * the review queue and nothing about money, because the queries for
 * the rest are never run for them.
 */
export default async function AdminOverview() {
  const actor = await currentAdmin();
  if (!actor) notFound();

  const seeBusinesses = can(actor.role, "businesses.read");
  const seeReviews = can(actor.role, "reviews.read");
  const seeMoney = can(actor.role, "payments.read");
  const seeAudit = can(actor.role, "audit.read");

  // The counts are shared with GET /api/admin/overview, which the app reads.
  const [counts, recentAudit] = await Promise.all([
    adminOverview(actor.role),
    seeAudit ? db.auditLog.findMany({ orderBy: { at: "desc" }, take: 8 }) : Promise.resolve([]),
  ]);
  const pendingBiz = counts.pendingBusinesses ?? 0;
  const totalBiz = counts.totalBusinesses ?? 0;
  const suspended = counts.suspendedBusinesses ?? 0;
  const openReports = counts.openReports ?? 0;
  const underReview = counts.reviewsUnderReview ?? 0;
  const paidBookings = counts.paidBookings ?? 0;

  const tiles: { label: string; value: string; hint?: string; href?: string }[] = [];
  if (seeBusinesses) {
    tiles.push(
      { label: "بانتظار المراجعة", value: String(pendingBiz), hint: "أعمال جديدة", href: "/admin/businesses?status=PENDING" },
      { label: "كل الأعمال", value: String(totalBiz), href: "/admin/businesses" },
      { label: "موقوفة", value: String(suspended), href: "/admin/businesses?status=SUSPENDED" },
    );
  }
  if (seeReviews) {
    tiles.push({
      label: "بلاغات مفتوحة",
      value: String(openReports),
      hint: `${underReview} تقييم تحت المراجعة`,
      href: "/admin/reviews",
    });
  }
  if (seeMoney) {
    tiles.push({ label: "حجوزات مدفوعة", value: String(paidBookings), href: "/admin/payments" });
  }

  return (
    <div>
      <AdminHeading
        title="نظرة عامة"
        subtitle="كل رقم هنا محسوب من قاعدة البيانات دلوقتي."
      />

      {tiles.length > 0 ? <Tiles items={tiles} /> : null}

      {seeAudit && (
        <section>
          <h2 className="m-0 mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">
            آخر النشاط
          </h2>
          <AdminTable
            head={["الوقت", "مين", "إيه اللي حصل"]}
            rows={recentAudit.map((a) => [
              <span key="t" className="num whitespace-nowrap text-[var(--color-subtle)]">{when(a.at)}</span>,
              <span key="w">
                {a.actorName ?? "النظام"}
                {a.actorRole && <> <Pill>{a.actorRole}</Pill></>}
              </span>,
              <span key="s">{a.summary}</span>,
            ])}
            empty="لسه مفيش نشاط مسجّل."
          />
        </section>
      )}
    </div>
  );
}
