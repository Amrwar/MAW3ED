import { db } from "@/lib/db";

/**
 * Organization-level loyalty and promotions (Phase 27, module I).
 *
 * The rule throughout: an organization reaches only the brands it OWNS
 * (an APPROVED, unsuspended OWNED association), and even there it
 * invites — each business's owner accepts or leaves. A mall that hosts a
 * tenant (HOSTED) or a company that manages one (MANAGED) never gains
 * its loyalty, its customers' data, or its payments.
 */

export async function ownedBusinessIds(organizationId: string): Promise<string[]> {
  const rows = await db.organizationBusiness.findMany({
    where: { organizationId, relation: "OWNED", status: "APPROVED", suspendedAt: null },
    select: { businessId: true },
  });
  return [...new Set(rows.map((r) => r.businessId))];
}

/** Invites every owned brand not yet invited. Idempotent. */
export async function inviteOwnedBrands(organizationId: string, programId: string): Promise<number> {
  const ids = await ownedBusinessIds(organizationId);
  if (ids.length === 0) return 0;
  const made = await db.loyaltyParticipation.createMany({
    data: ids.map((businessId) => ({ programId, businessId })),
    skipDuplicates: true,
  });
  return made.count;
}

/**
 * A promotion becomes an offer on each owned brand, switched OFF: the
 * business switches it on in its own offers page if it takes part. The
 * engine then applies it like any offer of the business's own.
 */
export async function distributePromotion(organizationId: string, promotionId: string): Promise<number> {
  const promo = await db.organizationPromotion.findFirst({ where: { id: promotionId, organizationId } });
  if (!promo) return 0;
  const ids = await ownedBusinessIds(organizationId);
  let made = 0;
  for (const businessId of ids) {
    const exists = await db.discount.count({ where: { businessId, organizationPromotionId: promo.id } });
    if (exists) continue;
    await db.discount.create({
      data: {
        businessId,
        organizationPromotionId: promo.id,
        nameAr: promo.nameAr.slice(0, 120),
        nameEn: promo.nameEn,
        kind: promo.kind,
        value: promo.value,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        isActive: false,
      },
    });
    made++;
  }
  return made;
}

/**
 * Packages and memberships across the owned brands that share reports
 * with the organization (the REPORTS scope): counts and sums only.
 */
export async function organizationPackageReport(organizationId: string) {
  const assoc = await db.organizationBusiness.findMany({
    // Live grants only, of an organization still approved: an expired grant
    // or a suspended organization sees nothing (final audit F-25).
    where: {
      organizationId, relation: "OWNED", status: "APPROVED", suspendedAt: null, scopes: { has: "REPORTS" },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      organization: { status: "APPROVED" },
    },
    select: { businessId: true, business: { select: { nameAr: true } } },
  });
  const rows = [];
  for (const a of assoc) {
    const [sold, active, used, members] = await Promise.all([
      db.customerPackage.aggregate({ where: { businessId: a.businessId, status: { not: "PENDING_PAYMENT" } }, _count: { _all: true }, _sum: { sessionsTotal: true } }),
      db.customerPackage.count({ where: { businessId: a.businessId, status: "ACTIVE" } }),
      db.customerPackage.aggregate({ where: { businessId: a.businessId }, _sum: { sessionsUsed: true } }),
      db.customerMembership.count({ where: { businessId: a.businessId, status: "ACTIVE" } }),
    ]);
    rows.push({
      businessId: a.businessId,
      name: a.business.nameAr,
      packagesSold: sold._count._all,
      sessionsSold: sold._sum.sessionsTotal ?? 0,
      sessionsUsed: used._sum.sessionsUsed ?? 0,
      activePackages: active,
      activeMemberships: members,
    });
  }
  return { businesses: rows };
}
