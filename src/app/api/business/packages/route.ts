import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/**
 * Package plans (sessions sold ahead) and the packages sold
 * (lib/entitlements, docs/architecture/MEMBERSHIPS_AND_PACKAGES.md).
 * Bounds mirror PackagePlan_rules_chk. Changing a plan never changes a
 * package already sold: the sale copied its sessions, services and price.
 */

const plan = z.object({
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80).nullable().optional(),
  serviceIds: z.array(z.string().max(40)).max(50),
  sessions: z.number().int().min(1).max(100),
  priceCents: z.number().int().min(1).max(100_000_000),
  validityDays: z.number().int().min(7).max(730),
});

export async function GET() {
  return businessHandle("packages GET", async () => {
    const { business } = await requireBusiness();
    const [plans, sold] = await Promise.all([
      db.packagePlan.findMany({
        where: { businessId: business.id },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        include: { _count: { select: { purchases: true } } },
      }),
      db.customerPackage.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, phoneE164: true, customerName: true, sessionsTotal: true, sessionsUsed: true,
          priceCents: true, status: true, expiresAt: true, createdAt: true, plan: { select: { nameAr: true } },
        },
      }),
    ]);
    return ok({ plans, sold });
  });
}

export async function POST(req: Request) {
  return businessHandle("packages POST", async () => {
    const { business } = await requireBusiness();
    const parsed = plan.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    // Only this business's services.
    const ids = [...new Set(parsed.data.serviceIds)];
    if (ids.length && (await db.service.count({ where: { id: { in: ids }, businessId: business.id } })) !== ids.length) {
      return err("خدمة غير موجودة", 422, { code: "bad-service" });
    }
    const row = await db.packagePlan.create({
      data: { ...parsed.data, nameEn: parsed.data.nameEn ?? null, serviceIds: ids, businessId: business.id },
    });
    return ok({ plan: row }, 201);
  });
}
