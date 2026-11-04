import { db } from "@/lib/db";
import { availablePoints, type Lot } from "@/lib/loyalty/rules";

/**
 * A customer's wallet: points, packages and memberships held under their
 * verified number, across every business. Read-only; what each holds is
 * the business's ledger (lib/loyalty, lib/entitlements).
 */
export async function walletFor(phoneE164: string, now: Date = new Date()) {
  const soon = new Date(now.getTime() + 30 * 86_400_000);
  const [accounts, packages, memberships] = await Promise.all([
    db.loyaltyAccount.findMany({
      where: { phoneE164 },
      select: {
        id: true, balance: true, lifetimeEarned: true,
        program: {
          select: {
            nameAr: true, nameEn: true, isActive: true, redeemPoints: true, redeemValueCents: true,
            business: { select: { nameAr: true, nameEn: true, slug: true } },
            organization: { select: { nameAr: true, nameEn: true, slug: true } },
          },
        },
        entries: { where: { remaining: { gt: 0 } }, select: { id: true, remaining: true, expiresAt: true, createdAt: true } },
      },
      take: 50,
    }),
    db.customerPackage.findMany({
      where: { phoneE164, status: { in: ["ACTIVE", "EXHAUSTED", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, sessionsTotal: true, sessionsUsed: true, status: true, expiresAt: true,
        plan: { select: { nameAr: true, nameEn: true } },
        business: { select: { nameAr: true, nameEn: true, slug: true } },
      },
    }),
    db.customerMembership.findMany({
      where: { phoneE164, status: { in: ["ACTIVE", "PAUSED", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, status: true, paidThrough: true, cancelAtPeriodEnd: true,
        plan: { select: { nameAr: true, nameEn: true } },
        business: { select: { nameAr: true, nameEn: true, slug: true } },
        periods: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, select: { used: true, includedVisits: true }, take: 1 },
      },
    }),
  ]);
  return {
    loyalty: accounts
      .filter((a) => a.program.isActive || a.balance > 0)
      .map((a) => {
        const lots = a.entries.map((e) => ({ ...e, remaining: e.remaining ?? 0 })) as Lot[];
        const expiring = lots.filter((l) => l.expiresAt && l.expiresAt > now && l.expiresAt <= soon);
        const owner = a.program.business ?? a.program.organization;
        return {
          id: a.id,
          programName: a.program.nameAr,
          programNameEn: a.program.nameEn,
          ownerName: owner?.nameAr ?? "",
          ownerNameEn: owner?.nameEn ?? null,
          href: a.program.business ? `/company/${a.program.business.slug}` : a.program.organization ? `/groups/${a.program.organization.slug}` : null,
          available: availablePoints(lots, now),
          lifetimeEarned: a.lifetimeEarned,
          worth: { points: a.program.redeemPoints, cents: a.program.redeemValueCents },
          expiringSoon: expiring.reduce((n, l) => n + l.remaining, 0),
          nextExpiry: expiring.map((l) => l.expiresAt!).sort((x, y) => x.getTime() - y.getTime())[0] ?? null,
        };
      }),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.plan.nameAr,
      nameEn: p.plan.nameEn,
      businessName: p.business.nameAr,
      businessNameEn: p.business.nameEn,
      href: `/company/${p.business.slug}`,
      left: Math.max(0, p.sessionsTotal - p.sessionsUsed),
      total: p.sessionsTotal,
      status: p.status,
      expiresAt: p.expiresAt,
    })),
    memberships: memberships.map((m) => ({
      id: m.id,
      name: m.plan.nameAr,
      nameEn: m.plan.nameEn,
      businessName: m.business.nameAr,
      businessNameEn: m.business.nameEn,
      href: `/company/${m.business.slug}`,
      status: m.status,
      paidThrough: m.paidThrough,
      cancelAtPeriodEnd: m.cancelAtPeriodEnd,
      used: m.periods[0]?.used ?? 0,
      included: m.periods[0]?.includedVisits ?? 0,
    })),
  };
}
