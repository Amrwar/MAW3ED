import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * The owner's rooms, chairs, tables and equipment.
 *
 * One endpoint for all of them, because they are one thing: something
 * an appointment holds for a stretch of time. The kind is a label.
 */

const resourceSchema = z.object({
  name: z.string().trim().min(1, "أدخل الاسم").max(80),
  kind: z.enum(["TABLE", "ROOM", "CHAIR", "EQUIPMENT", "OTHER"]).default("OTHER"),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  area: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  photo: z.string().url().nullable().optional(),
  branchId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export async function GET() {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const resources = await db.resource.findMany({
      where: { businessId: ctx.business.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        branch: { select: { id: true, nameAr: true } },
        _count: { select: { bookings: true } },
      },
    });

    return ok({ resources });
  } catch (e) {
    log.error("[resources GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const parsed = resourceSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { branchId, ...rest } = parsed.data;

    // A branch from another business would attach this owner's resource
    // to somebody else's location.
    if (branchId) {
      const branch = await db.branch.findFirst({
        where: { id: branchId, businessId: ctx.business.id },
        select: { id: true },
      });
      if (!branch) return err("الفرع غير موجود", 404);
    }

    const resource = await db.resource.create({
      data: {
        businessId: ctx.business.id,
        branchId: branchId ?? null,
        name: rest.name,
        kind: rest.kind,
        capacity: rest.capacity ?? null,
        area: rest.area ?? null,
        notes: rest.notes ?? null,
        photo: rest.photo ?? null,
        isActive: rest.isActive ?? true,
        sortOrder: rest.sortOrder ?? 0,
      },
      include: { branch: { select: { id: true, nameAr: true } }, _count: { select: { bookings: true } } },
    });

    return ok({ resource }, 201);
  } catch (e) {
    log.error("[resources POST]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
