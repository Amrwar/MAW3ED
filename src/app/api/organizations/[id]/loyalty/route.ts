import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { inviteOwnedBrands } from "@/lib/organizations/loyalty";

/**
 * GET/PUT /api/organizations/:id/loyalty — one loyalty program across the
 * brands the organization OWNS (lib/organizations/loyalty). PUT sets the
 * rules and invites every owned brand; each brand's owner accepts in
 * their dashboard. Participation never reaches a HOSTED or MANAGED one.
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org loyalty GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.view");
    const program = await db.loyaltyProgram.findUnique({
      where: { organizationId: id },
      include: { participations: { select: { businessId: true, acceptedAt: true, leftAt: true, business: { select: { nameAr: true } } } } },
    });
    const outstanding = program ? await db.loyaltyAccount.aggregate({ where: { programId: program.id }, _sum: { balance: true }, _count: { _all: true } }) : null;
    return ok({
      program,
      members: outstanding?._count._all ?? 0,
      outstandingPoints: outstanding?._sum.balance ?? 0,
    });
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org loyalty PUT", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.edit");
    const parsed = rules.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const data = { ...parsed.data, nameEn: parsed.data.nameEn ?? null };
    const program = await db.loyaltyProgram.upsert({
      where: { organizationId: id },
      create: { organizationId: id, ...data },
      update: data,
    });
    const invited = await inviteOwnedBrands(id, program.id);
    return ok({ program, invited });
  });
}
