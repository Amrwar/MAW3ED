import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { normaliseCode } from "@/lib/discounts/apply";

/**
 * The business's own offers.
 *
 * One endpoint for both faces: a body with a code creates a coupon, a
 * body without one creates a promotion that applies by itself. The
 * difference is a nullable column, not a second route.
 */

const schema = z
  .object({
    nameAr: z.string().trim().min(2).max(120),
    nameEn: z.string().trim().max(120).optional().nullable(),
    /** Omitted or empty means a promotion. */
    code: z.string().trim().max(40).optional().nullable(),
    kind: z.enum(["PERCENT", "FIXED"]),
    value: z.number().int().positive(),
    minSpendCents: z.number().int().positive().nullable().optional(),
    maxDiscountCents: z.number().int().positive().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    perCustomerLimit: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    serviceIds: z.array(z.string()).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.kind !== "PERCENT" || v.value <= 100, {
    message: "النسبة لازم تكون من 1 لـ 100",
    path: ["value"],
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.endsAt) > new Date(v.startsAt), {
    message: "تاريخ الانتهاء لازم يكون بعد تاريخ البداية",
    path: ["endsAt"],
  });

export async function GET() {
  try {
    const { business } = await requireBusiness();

    const rows = await db.discount.findMany({
      where: { businessId: business.id },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, code: true, nameAr: true, nameEn: true, kind: true, value: true,
        minSpendCents: true, maxDiscountCents: true, maxRedemptions: true,
        perCustomerLimit: true, redemptionCount: true, startsAt: true, endsAt: true,
        isActive: true, serviceIds: true, createdAt: true,
        _count: { select: { redemptions: true } },
      },
    });

    // What the offers have actually given away, which is the number an
    // owner wants before deciding whether to run another one.
    const given = await db.discountRedemption.groupBy({
      by: ["discountId"],
      where: { discount: { businessId: business.id } },
      _sum: { amountCents: true },
    });
    const givenBy = new Map(given.map((g) => [g.discountId, g._sum.amountCents ?? 0]));

    return ok({
      discounts: rows.map((d) => ({
        ...d,
        startsAt: d.startsAt?.toISOString() ?? null,
        endsAt: d.endsAt?.toISOString() ?? null,
        createdAt: d.createdAt.toISOString(),
        givenAwayCents: givenBy.get(d.id) ?? 0,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[discounts GET]", e);
    return err("حدث خطأ", 500);
  }
}

export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    }
    const d = parsed.data;

    const code = d.code ? normaliseCode(d.code) : null;

    // Unique within this business only — two salons may both run
    // "EID20" — so the clash to report is a local one.
    if (code) {
      const clash = await db.discount.findFirst({
        where: { businessId: business.id, code },
        select: { id: true },
      });
      if (clash) return err("الكود ده مستخدم عندك بالفعل", 409);
    }

    // Services are checked against this business so an id from
    // somebody else's catalogue cannot be attached.
    let serviceIds: string[] = [];
    if (d.serviceIds?.length) {
      const owned = await db.service.findMany({
        where: { id: { in: d.serviceIds }, businessId: business.id },
        select: { id: true },
      });
      serviceIds = owned.map((s) => s.id);
      if (serviceIds.length !== d.serviceIds.length) {
        return err("فيه خدمة مش تابعة للنشاط ده", 422);
      }
    }

    const created = await db.discount.create({
      data: {
        businessId: business.id,
        code,
        nameAr: d.nameAr,
        nameEn: d.nameEn || null,
        kind: d.kind,
        value: d.value,
        minSpendCents: d.minSpendCents ?? null,
        maxDiscountCents: d.maxDiscountCents ?? null,
        maxRedemptions: d.maxRedemptions ?? null,
        perCustomerLimit: d.perCustomerLimit ?? null,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        serviceIds,
        isActive: d.isActive ?? true,
      },
      select: { id: true },
    });

    return ok({ id: created.id }, 201);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[discounts POST]", e);
    return err("حدث خطأ", 500);
  }
}
