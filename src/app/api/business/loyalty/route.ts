import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/**
 * The business's own loyalty program (lib/loyalty, docs/architecture/LOYALTY_LEDGER.md).
 *
 * GET: its rules, what is outstanding, and organization programs it was
 * invited to. PUT: create or change its rules — bounds mirror the
 * database CHECK (LoyaltyProgram_rules_chk). Changing rules never
 * changes points already earned: each lot keeps its own expiry.
 */

const rules = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80).nullable().optional(),
  isActive: z.boolean(),
  pointsPerVisit: z.number().int().min(0).max(10_000),
  pointsPer100Egp: z.number().int().min(0).max(10_000),
  redeemPoints: z.number().int().min(1).max(1_000_000),
  redeemValueCents: z.number().int().min(1).max(10_000_000),
  maxRedeemPercent: z.number().int().min(0).max(100),
  expiryDays: z.number().int().min(30).max(3650).nullable(),
  dailyEarnCap: z.number().int().min(1).max(10),
});

export async function GET() {
  return businessHandle("loyalty GET", async () => {
    const { business } = await requireBusiness();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const program = await db.loyaltyProgram.findUnique({ where: { businessId: business.id } });
    const [accounts, outstanding, earned, redeemed, invitations] = await Promise.all([
      program ? db.loyaltyAccount.count({ where: { programId: program.id } }) : 0,
      program ? db.loyaltyAccount.aggregate({ where: { programId: program.id }, _sum: { balance: true } }) : null,
      program ? db.loyaltyEntry.aggregate({ where: { programId: program.id, kind: "EARN", createdAt: { gte: since } }, _sum: { points: true } }) : null,
      program ? db.loyaltyEntry.aggregate({ where: { programId: program.id, kind: "REDEEM", createdAt: { gte: since } }, _sum: { points: true } }) : null,
      db.loyaltyParticipation.findMany({
        where: { businessId: business.id },
        select: {
          id: true, acceptedAt: true, leftAt: true,
          program: { select: { id: true, nameAr: true, isActive: true, organization: { select: { nameAr: true } } } },
        },
      }),
    ]);
    return ok({
      program,
      stats: {
        accounts,
        outstandingPoints: outstanding?._sum.balance ?? 0,
        earnedLast30: earned?._sum.points ?? 0,
        redeemedLast30: -(redeemed?._sum.points ?? 0),
      },
      invitations: invitations.map((i) => ({
        id: i.id,
        programId: i.program.id,
        programName: i.program.nameAr,
        organizationName: i.program.organization?.nameAr ?? null,
        accepted: !!i.acceptedAt && !i.leftAt,
        left: !!i.leftAt,
      })),
    });
  });
}

export async function PUT(req: Request) {
  return businessHandle("loyalty PUT", async () => {
    const { business } = await requireBusiness();
    const parsed = rules.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const data = { ...parsed.data, nameEn: parsed.data.nameEn ?? null };
    const program = await db.loyaltyProgram.upsert({
      where: { businessId: business.id },
      create: { businessId: business.id, ...data },
      update: data,
    });
    return ok({ program });
  });
}
