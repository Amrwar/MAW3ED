/**
 * PATCH /api/business/settings/booking
 * Body: { autoConfirm: boolean }
 *
 * Whether a new online booking is confirmed on the spot or waits for
 * the owner to confirm or decline it. The column always existed and
 * the booking route always read it; nothing let an owner change it.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

const schema = z.object({ autoConfirm: z.boolean() });

export async function PATCH(req: Request) {
  try {
    const { business } = await requireBusiness();
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err("قيمة غير صالحة", 422);

    const updated = await db.business.update({
      where: { id: business.id },
      data: { autoConfirm: parsed.data.autoConfirm },
      select: { autoConfirm: true },
    });
    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking settings PATCH]", e);
    return err("حدث خطأ أثناء حفظ الإعدادات", 500);
  }
}
