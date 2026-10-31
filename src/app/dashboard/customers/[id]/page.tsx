import { can } from "@/lib/business-access";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getCustomer } from "@/lib/dashboard/queries";
import CustomerProfile from "../_components/CustomerProfile";

export const metadata: Metadata = { title: "ملف العميل" };

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { business, actor } = await requireDashboardAccess("customers.read");
  const seeMoney = can(actor, "finance.read");
  const { id } = await params;

  // Scoped to this business inside the query: an id belonging to
  // somebody else's customer does not resolve, it 404s.
  const customer = await getCustomer(business.id, id);
  if (!customer) notFound();

  return (
    <CustomerProfile
      customer={{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
        notesUpdatedAt: customer.notesUpdatedAt?.toISOString() ?? null,
        tags: customer.tags,
        since: customer.createdAt.toISOString(),
      }}
      stats={{
        visits: customer.stats.visits,
        cancelled: customer.stats.cancelled,
        noShows: customer.stats.noShows,
        upcoming: customer.stats.upcoming,
        spend: seeMoney ? customer.stats.revenue : 0,
        noShowRate: customer.stats.noShowRate,
        firstSeen: customer.stats.firstSeen?.toISOString() ?? null,
        lastVisit: customer.stats.lastVisit?.toISOString() ?? null,
        nextVisit: customer.stats.nextVisit?.toISOString() ?? null,
      }}
      history={customer.history.map((h) => ({
        id: h.id,
        reference: h.reference,
        status: h.status,
        at: h.at.toISOString(),
        startTime: h.startTime,
        endTime: h.endTime,
        serviceName: h.serviceName,
        staffName: h.staffName,
        price: h.price,
        currency: h.currency,
        rating: h.rating,
      }))}
    />
  );
}
