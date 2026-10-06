import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(["TABLE", "ROOM", "CHAIR", "EQUIPMENT", "OTHER"]).optional(),
  capacity: z.number().int().min(1).max(500).nullable().optional(),
  area: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  photo: z.string().url().nullable().optional(),
  branchId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

/** Every handler scopes by businessId, so an id from another owner 404s. */
async function owned(id: string, businessId: string) {
  return db.resource.findFirst({ where: { id, businessId }, select: { id: true } });
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const { id } = await params;
    if (!(await owned(id, ctx.business.id))) return err("غير موجود", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    if (parsed.data.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: parsed.data.branchId, businessId: ctx.business.id },
        select: { id: true },
      });
      if (!branch) return err("الفرع غير موجود", 404);
    }

    const resource = await db.resource.update({
      where: { id },
      data: parsed.data,
      include: { branch: { select: { id: true, nameAr: true } }, _count: { select: { bookings: true } } },
    });

    return ok({ resource });
  } catch (e) {
    log.error("[resource PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const { id } = await params;
    if (!(await owned(id, ctx.business.id))) return err("غير موجود", 404);

    // A resource with history is deactivated rather than deleted:
    // removing it would detach it from bookings that already happened
    // and leave the calendar unable to say where they were.
    const booked = await db.booking.count({ where: { resourceId: id } });

    if (booked > 0) {
      await db.resource.update({ where: { id }, data: { isActive: false } });
      return ok({ deactivated: true, bookings: booked });
    }

    await db.resource.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    log.error("[resource DELETE]", e);
    return err("حدث خطأ أثناء الحذف", 500);
  }
}
