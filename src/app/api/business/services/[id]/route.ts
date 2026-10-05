import { db } from "@/lib/db";
import { serviceSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/** PUT /api/business/services/[id] */
export async function PUT(req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;
    const body = await req.json();
    const parsed = serviceSchema.partial().safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // Verify ownership
    const service = await db.service.findFirst({
      where: { id, businessId: business.id },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    const updated = await db.service.update({
      where: { id },
      data:  parsed.data,
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[service [id]]", e);
    return err("حدث خطأ أثناء التحديث", 500);
  }
}

/** DELETE /api/business/services/[id] */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const service = await db.service.findFirst({
      where: { id, businessId: business.id },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    await db.service.delete({ where: { id } });

    return ok({ deleted: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[service [id]]", e);
    return err("حدث خطأ أثناء الحذف", 500);
  }
}
