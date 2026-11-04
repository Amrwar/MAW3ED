import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/**
 * Membership plans (a fee per period with included visits) and the
 * memberships held. Bounds mirror MembershipPlan_rules_chk. A plan's
 * price or visits changing never changes a membership already sold.
 */
const plan = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80).nullable().optional(),
  serviceIds: z.array(z.string().max(40)).max(50),
  priceCents: z.number().int().min(1).max(100_000_000),
  periodDays: z.number().int().min(7).max(366),
  includedVisits: z.number().int().min(1).max(100),
});

export async function GET() {
  return businessHandle("memberships GET", async () => {
    const { business } = await requireBusiness();
    const now = new Date();
    const [plans, members] = await Promise.all([
      db.membershipPlan.findMany({
        where: { businessId: business.id },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        include: { _count: { select: { memberships: true } } },
      }),
      db.customerMembership.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, phoneE164: true, customerName: true, status: true, paidThrough: true, pausedDays: true,
          cancelAtPeriodEnd: true, includedVisits: true, priceCents: true, plan: { select: { nameAr: true } },
          periods: { where: { startsAt: { lte: now }, endsAt: { gt: now } }, select: { used: true, includedVisits: true, endsAt: true }, take: 1 },
        },
      }),
    ]);
    return ok({
      plans,
      members: members.map(({ periods, ...m }) => ({ ...m, current: periods[0] ?? null })),
    });
  });
}

export async function POST(req: Request) {
  return businessHandle("memberships POST", async () => {
    const { business } = await requireBusiness();
    const parsed = plan.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const ids = [...new Set(parsed.data.serviceIds)];
    if (ids.length && (await db.service.count({ where: { id: { in: ids }, businessId: business.id } })) !== ids.length) {
      return err("خدمة غير موجودة", 422, { code: "bad-service" });
    }
    const row = await db.membershipPlan.create({
      data: { ...parsed.data, nameEn: parsed.data.nameEn ?? null, serviceIds: ids, businessId: business.id },
    });
    return ok({ plan: row }, 201);
  });
}
