import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { getNotifications } from "@/lib/account/queries";
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
    const session = await requireSession();

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return err("بيانات غير صالحة", 422);

    const result = await db.notification.updateMany({
      where: { id: { in: parsed.data.ids }, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return ok({ updated: result.count });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[notifications PATCH]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * GET /api/account/notifications
 *
 * The list the bell opens, newest first, with how many are unread.
 *
 * The website reads this through a server component; the app has to ask
 * for it. Same query either way.
 */
export async function GET() {
  try {
    const session = await requireSession();

    // getNotifications already counts the unread ones; recounting here
    // would be a second answer to the same question.
    const { items, unread } = await getNotifications(session.user.id);

    return ok({ notifications: items, unread });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[notifications GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
