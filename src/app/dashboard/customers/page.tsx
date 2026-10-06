import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getCustomers, type CustomerSort } from "@/lib/dashboard/queries";
import CustomersClient from "./_components/CustomersClient";

export const metadata: Metadata = { title: "العملاء" };

const PER_PAGE = 25;

/**
 * The customer list.
 *
 * Every figure beside a name — visits, cancellations, missed
 * appointments, what they have spent — is counted from their bookings
 * when the page loads. Nothing is stored and nothing is estimated.
 *
 * Note this replaces a "total spend" that summed confirmed *and*
 * completed bookings, which counted money for appointments that had not
 * happened yet.
 */
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireBusinessPage();
  const sp = await searchParams;

  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const page = Math.max(1, Number(one("page") ?? 1) || 1);
  const sort = (one("sort") ?? "recent") as CustomerSort;

  const { items, total, allTags } = await getCustomers(business.id, {
    q: one("q"),
    tag: one("tag"),
    noShows: one("noShows") === "1",
    returning: one("returning") === "1",
    sort,
    take: PER_PAGE,
    skip: (page - 1) * PER_PAGE,
  });

  return (
    <CustomersClient
      rows={items.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        tags: c.tags,
        hasNotes: c.hasNotes,
        visits: c.stats.visits,
        cancelled: c.stats.cancelled,
        noShows: c.stats.noShows,
        spend: c.stats.revenue,
        noShowRate: c.stats.noShowRate,
        lastVisit: c.stats.lastVisit?.toISOString() ?? null,
        nextVisit: c.stats.nextVisit?.toISOString() ?? null,
      }))}
      total={total}
      page={page}
      perPage={PER_PAGE}
      allTags={allTags}
    />
  );
}
