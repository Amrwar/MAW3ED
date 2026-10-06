import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * Saved businesses.
 *
 * Keyed on the signed-in user, so a saved place follows them to a new
 * phone — which the localStorage list it replaces never did.
 */

const bodySchema = z.object({ businessId: z.string().min(1) });
/** The one-off hand-over from the device list; capped so it cannot be abused. */
const mergeSchema = z.object({ businessIds: z.array(z.string().min(1)).max(100) });

async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await requireUser();
    if (!userId) return err("غير مصرح", 401);

    const favorites = await db.favorite.findMany({
      where: { userId },
      select: { businessId: true },
    });

    return ok({ businessIds: favorites.map((f) => f.businessId) });
  } catch (e) {
    log.error("[favorites GET]", e);
    return err("حدث خطأ", 500);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    if (!userId) return err("غير مصرح", 401);

    const body = await req.json().catch(() => null);

    // Two shapes: save one, or hand over a whole device list on first
    // sign-in. The merge is idempotent, so running it twice is safe.
    const merge = mergeSchema.safeParse(body);
    if (merge.success) {
      const existing = await db.business.findMany({
        where: { id: { in: merge.data.businessIds }, isPublished: true },
        select: { id: true },
      });

      if (existing.length > 0) {
        await db.favorite.createMany({
          data: existing.map((b) => ({ userId, businessId: b.id })),
          skipDuplicates: true,
        });
      }

      const all = await db.favorite.findMany({ where: { userId }, select: { businessId: true } });
      return ok({ businessIds: all.map((f) => f.businessId), merged: existing.length });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return err("بيانات غير صالحة", 422);

    const business = await db.business.findFirst({
      where: { id: parsed.data.businessId, isPublished: true },
      select: { id: true },
    });
    if (!business) return err("النشاط غير موجود", 404);

    await db.favorite.upsert({
      where: { userId_businessId: { userId, businessId: business.id } },
      create: { userId, businessId: business.id },
      update: {},
    });

    return ok({ saved: true }, 201);
  } catch (e) {
    log.error("[favorites POST]", e);
    return err("حدث خطأ", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireUser();
    if (!userId) return err("غير مصرح", 401);

    const businessId = new URL(req.url).searchParams.get("businessId");
    if (!businessId) return err("businessId مطلوب", 400);

    // deleteMany, not delete: removing something already gone should
    // not be an error, so the button is safe to press twice.
    await db.favorite.deleteMany({ where: { userId, businessId } });

    return ok({ removed: true });
  } catch (e) {
    log.error("[favorites DELETE]", e);
    return err("حدث خطأ", 500);
  }
}
