import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";

const patchSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) });

/**
 * PATCH /api/account/notifications
 *
 * Marks notifications read. Scoped by userId, so an id belonging to
 * somebody else matches nothing rather than erroring — which would
 * otherwise confirm that the id exists.
 */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return err("غير مصرح", 401);

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err("بيانات غير صالحة", 422);

    const result = await db.notification.updateMany({
      where: { id: { in: parsed.data.ids }, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return ok({ updated: result.count });
  } catch (e) {
    log.error("[notifications PATCH]", e);
    return err("حدث خطأ", 500);
  }
}
