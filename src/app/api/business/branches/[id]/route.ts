import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  nameAr: z.string().trim().min(1).max(80).optional(),
  nameEn: z.string().trim().max(80).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

async function owned(id: string, businessId: string) {
  return db.branch.findFirst({ where: { id, businessId }, select: { id: true } });
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const { id } = await params;
    if (!(await owned(id, ctx.business.id))) return err("غير موجود", 404);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const branch = await db.branch.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { bookings: true, resources: true } } },
    });

    return ok({ branch });
  } catch (e) {
    log.error("[branch PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const { id } = await params;
    if (!(await owned(id, ctx.business.id))) return err("غير موجود", 404);

    // Same rule as resources: history is kept, the branch is retired.
    const booked = await db.booking.count({ where: { branchId: id } });

    if (booked > 0) {
      await db.branch.update({ where: { id }, data: { isActive: false } });
      return ok({ deactivated: true, bookings: booked });
    }

    await db.branch.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    log.error("[branch DELETE]", e);
    return err("حدث خطأ أثناء الحذف", 500);
  }
}
