import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ isActive: z.boolean() });

/**
 * PATCH /api/business/discounts/[id]
 *
 * Switch an offer on or off. That is the only edit allowed.
 *
 * Changing the value or the rules of an offer people have already
 * redeemed would make the redemptions unexplainable — a customer who
 * got 20% off would be sitting against a record that says 10%. To
 * change the terms, switch this one off and make another.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("طلب غير صالح", 422);

    const existing = await db.discount.findFirst({
      where: { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) return err("العرض غير موجود", 404);

    await db.discount.update({
      where: { id },
      data: { isActive: parsed.data.isActive },
    });

    return ok({ id, isActive: parsed.data.isActive });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[discount PATCH]", e);
    return err("حدث خطأ", 500);
  }
}

/**
 * DELETE /api/business/discounts/[id]
 *
 * Only an offer nobody has used. Once it has been redeemed it is part
 * of what happened, and the bookings that carry it would lose the
 * record of why they cost what they did — so it is switched off
 * instead, and says so.
 */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const existing = await db.discount.findFirst({
      where: { id, businessId: business.id },
      select: { id: true, _count: { select: { redemptions: true } } },
    });
    if (!existing) return err("العرض غير موجود", 404);

    if (existing._count.redemptions > 0) {
      return err("العرض ده اتستخدم قبل كده، تقدر توقّفه بس مش تمسحه", 409);
    }

    await db.discount.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[discount DELETE]", e);
    return err("حدث خطأ", 500);
  }
}
