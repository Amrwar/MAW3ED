import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminHeading, AdminTable, Pill, when } from "../_components/AdminBits";
import { adminMetadata } from "@/lib/admin/meta";

export const generateMetadata = adminMetadata("customers.read", "قائمة الانتظار");

/**
 * What people searched for and could not find, and asked to hear about.
 *
 * Read as demand first: the summary groups by search and city, busiest
 * first, which is the list of businesses worth going out to sign up.
 * The emails are below it, for sending the one message the form
 * promised once a match is listed.
 */
export default async function AdminWaitlistPage() {
  await requireAdminPage("customers.read");

  const [grouped, recent] = await Promise.all([
    db.waitlistRequest.groupBy({
      by: ["query", "citySlug"],
      // Confirmed only: an unconfirmed row is an address somebody typed.
      where: { notifiedAt: null, confirmedAt: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { query: "desc" } },
      take: 50,
    }),
    db.waitlistRequest.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);

  return (
    <div>
      <AdminHeading
        title="قائمة الانتظار"
        subtitle="ناس دوّرت على حاجة مش موجودة وطلبت نبلّغها لما تتضاف. إيميل واحد بس، زي ما الفورم بيقول."
      />

      <AdminTable
        head={["البحث", "المدينة", "مستنيين"]}
        rows={grouped.map((g) => [
          <span key="q" className="font-bold text-[var(--color-ink)]" dir="auto">{g.query}</span>,
          g.citySlug ? <code key="c" className="text-[0.6875rem]" dir="ltr">{g.citySlug}</code> : <Pill key="c">أي مدينة</Pill>,
          <span key="n" className="num">{g._count._all}</span>,
        ])}
        empty="مفيش حد مستني حاجة لسه."
      />

      <h2 className="mb-3 mt-8 text-[1rem] font-bold text-[var(--color-ink)]">آخر الطلبات</h2>
      <AdminTable
        head={["الإيميل", "البحث", "المدينة", "اللغة", "وقت الطلب", "أكّد", "اتبلّغ"]}
        rows={recent.map((r) => [
          <span key="e" dir="ltr">{r.email}</span>,
          <span key="q" dir="auto">{r.query}</span>,
          <code key="c" className="text-[0.6875rem]" dir="ltr">{r.citySlug || "—"}</code>,
          r.lang,
          when(r.createdAt),
          r.confirmedAt ? when(r.confirmedAt) : <Pill key="c2">لسه — متبعتلوش</Pill>,
          r.notifiedAt ? when(r.notifiedAt) : <Pill key="n">لسه</Pill>,
        ])}
        empty="مفيش طلبات."
      />
    </div>
  );
}
