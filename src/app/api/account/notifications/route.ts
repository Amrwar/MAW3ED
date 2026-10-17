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
 * GET /api/account/notifications?cursor=&take=
 *
 * The list the bell opens, newest first, with how many are unread.
 *
 * Paged by cursor, and backwards compatible: with no parameters it is
 * the newest 50, in `notifications`, exactly as before. `nextCursor` is
 * the id to pass as `cursor` for the next page, and null on the last
 * one; a client that ignores it still gets the first page it always got.
 * `take` is 1..100 (default 50).
 *
 * The website reads this through a server component; the app has to ask
 * for it. Same query either way.
 */
const getSchema = z.object({
  cursor: z.string().min(1).max(64).optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireSession();

    const url = new URL(req.url);
    const parsed = getSchema.safeParse({
      cursor: url.searchParams.get("cursor") || undefined,
      take: url.searchParams.get("take") || undefined,
    });
    if (!parsed.success) return err("بيانات غير صالحة", 400, { code: "bad-params" });

    // getNotifications already counts the unread ones; recounting here
    // would be a second answer to the same question.
    const { items, unread, nextCursor } = await getNotifications(
      session.user.id,
      parsed.data.take ?? 50,
      parsed.data.cursor,
    );

    return ok({ notifications: items, unread, nextCursor });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[notifications GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
