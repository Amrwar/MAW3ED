import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getAttributionReport } from "@/lib/dashboard/attribution";
import { bookingLinkFor, LINKABLE_SOURCES } from "@/lib/attribution/source";
import { siteUrl } from "@/lib/url";
import LinksClient from "./_components/LinksClient";

export const metadata: Metadata = { title: "روابط الحجز" };

/**
 * Where bookings come from, and the links that produce them.
 *
 * One page rather than three, because the links and the numbers only
 * mean anything together: a channel's conversion is unreadable without
 * knowing which link was handed out there, and a link is worth putting
 * somewhere only if you can tell afterwards whether it worked.
 */
export default async function LinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireBusinessPage();

  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.days) ? sp.days[0] : (sp.days ?? 30));
  const days = [7, 30, 90].includes(raw) ? raw : 30;

  const report = await getAttributionReport(business.id, days);

  const links = LINKABLE_SOURCES.map((source) => ({
    source,
    url: bookingLinkFor(siteUrl(""), business.slug, source),
  }));

  return (
    <LinksClient
      plainUrl={siteUrl(`/company/${business.slug}`)}
      businessName={business.nameAr}
      links={links}
      report={report}
    />
  );
}
