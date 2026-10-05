/**
 * PATCH /api/business/settings/deposit
 *
 * Update deposit settings for the authenticated business.
 * Body: { depositEnabled: boolean, depositPercent?: number (1–100) }
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

const depositSettingsSchema = z.object({
  depositEnabled: z.boolean(),
  depositPercent: z.number().int().min(1).max(100).optional(),
});

export async function PATCH(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body   = await req.json();
    const parsed = depositSettingsSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { depositEnabled, depositPercent } = parsed.data;

    const updated = await db.business.update({
      where: { id: business.id },
      data:  {
        depositEnabled,
        ...(depositPercent !== undefined ? { depositPercent } : {}),
      },
      select: { depositEnabled: true, depositPercent: true },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[deposit settings PATCH]", e);
    return err("حدث خطأ أثناء حفظ الإعدادات", 500);
  }
}

/**
 * GET /api/business/settings/deposit
 * Returns current deposit settings for the authenticated business.
 */
export async function GET(_req: Request) {
  try {
    const { business } = await requireBusiness();

    const data = await db.business.findUnique({
      where:  { id: business.id },
      select: { depositEnabled: true, depositPercent: true },
    });

    return ok(data);
  } catch (e) {
    if (e instanceof Response) return e;
    return err("حدث خطأ", 500);
  }
}
