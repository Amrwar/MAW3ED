import { z } from "zod";
import {
  PLAN_NAMES_AR,
  cheapestPlanWith,
  effectivePlanOf,
  wouldExceed,
} from "@/lib/plans";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

/** The business's locations. Most have one and never visit this page. */
const branchSchema = z.object({
  nameAr: z.string().trim().min(1, "أدخل اسم الفرع").max(80),
  nameEn: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function GET() {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const branches = await db.branch.findMany({
      where: { businessId: ctx.business.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { bookings: true, resources: true } } },
    });

    return ok({ branches });
  } catch (e) {
    log.error("[branches GET]", e);
    return err("حدث خطأ", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const parsed = branchSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // Multi-branch is an entitlement. A ceiling of one means a single
    // location, which is the normal case and not a feature — so this
    // only bites on the second branch. Asked before creating, so a
    // lapsed plan never deletes a branch somebody already has.
    const plan    = effectivePlanOf(ctx.business);
    const current = await db.branch.count({ where: { businessId: ctx.business.id } });

    if (wouldExceed(plan, "branches", current)) {
      const upgrade = cheapestPlanWith("branches");
      return err(
        `الفروع المتعددة متاحة في خطة ${upgrade ? PLAN_NAMES_AR[upgrade] : "أعلى"}.`,
        403,
      );
    }

    const branch = await db.branch.create({
      data: {
        businessId: ctx.business.id,
        nameAr: parsed.data.nameAr,
        nameEn: parsed.data.nameEn ?? null,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        isActive: parsed.data.isActive ?? true,
        sortOrder: parsed.data.sortOrder ?? 0,
      },
      include: { _count: { select: { bookings: true, resources: true } } },
    });

    return ok({ branch }, 201);
  } catch (e) {
    log.error("[branches POST]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
