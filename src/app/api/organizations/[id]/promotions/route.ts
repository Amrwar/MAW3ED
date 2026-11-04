import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { distributePromotion } from "@/lib/organizations/loyalty";

/**
 * GET/POST /api/organizations/:id/promotions — a promotion across the
 * brands the organization OWNS. Each becomes an offer on each brand,
 * switched off until that brand's owner switches it on (per-business
 * participation); GET shows which have.
 */
const body = z.object({
  nameAr: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120).nullable().optional(),
  kind: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
}).refine((v) => v.kind !== "PERCENT" || v.value <= 100, { message: "النسبة من 1 لـ 100", path: ["value"] });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org promotions GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.view");
    const promos = await db.organizationPromotion.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const offers = await db.discount.findMany({
      where: { organizationPromotionId: { in: promos.map((p) => p.id) } },
      select: { organizationPromotionId: true, isActive: true, business: { select: { nameAr: true } } },
    });
    return ok({
      promotions: promos.map((p) => ({
        ...p,
        brands: offers.filter((o) => o.organizationPromotionId === p.id).map((o) => ({ name: o.business.nameAr, on: o.isActive })),
      })),
    });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org promotions POST", async () => {
    const { id } = await params;
    const { caller } = await requireOrgAccess(id, "org.edit");
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const d = parsed.data;
    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) return err("تاريخ الانتهاء لازم يكون بعد البداية", 422);
    const promo = await db.organizationPromotion.create({
      data: {
        organizationId: id, nameAr: d.nameAr, nameEn: d.nameEn ?? null, kind: d.kind, value: d.value,
        startsAt: d.startsAt ? new Date(d.startsAt) : null, endsAt: d.endsAt ? new Date(d.endsAt) : null,
        createdById: caller.userId,
      },
    });
    const offered = await distributePromotion(id, promo.id);
    return ok({ promotion: promo, offered }, 201);
  });
}
