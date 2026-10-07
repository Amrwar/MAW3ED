import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import OffersClient, { type OfferRow } from "./_components/OffersClient";

export const metadata: Metadata = { title: "العروض والأكواد" };

/**
 * Coupons and promotions, which are the same record.
 *
 * One with a code is typed by the customer; one without applies by
 * itself to anything matching its rules. The page says which is which
 * rather than keeping them in separate lists, because an owner
 * deciding what to run wants to see all of it at once.
 */
export default async function OffersPage() {
  const { business } = await requireBusinessPage();

  const [discounts, services, given] = await Promise.all([
    db.discount.findMany({
      where: { businessId: business.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, code: true, nameAr: true, kind: true, value: true,
        minSpendCents: true, maxDiscountCents: true, maxRedemptions: true,
        perCustomerLimit: true, redemptionCount: true, startsAt: true,
        endsAt: true, isActive: true, serviceIds: true,
        _count: { select: { redemptions: true } },
      },
    }),
    db.service.findMany({
      where: { businessId: business.id, isAvailable: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nameAr: true },
    }),
    db.discountRedemption.groupBy({
      by: ["discountId"],
      where: { discount: { businessId: business.id } },
      _sum: { amountCents: true },
    }),
  ]);

  const givenBy = new Map(given.map((g) => [g.discountId, g._sum.amountCents ?? 0]));

  const rows: OfferRow[] = discounts.map((d) => ({
    id: d.id,
    code: d.code,
    nameAr: d.nameAr,
    kind: d.kind,
    value: d.value,
    minSpendCents: d.minSpendCents,
    maxDiscountCents: d.maxDiscountCents,
    maxRedemptions: d.maxRedemptions,
    perCustomerLimit: d.perCustomerLimit,
    redemptionCount: d.redemptionCount,
    startsAt: d.startsAt?.toISOString() ?? null,
    endsAt: d.endsAt?.toISOString() ?? null,
    isActive: d.isActive,
    serviceIds: d.serviceIds,
    usedCount: d._count.redemptions,
    givenAwayCents: givenBy.get(d.id) ?? 0,
  }));

  return <OffersClient rows={rows} services={services} />;
}
