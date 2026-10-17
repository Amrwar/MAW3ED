import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireSession } from "@/lib/api";
import { getFavorites } from "@/lib/account/queries";
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

/**
 * requireSession rather than auth(): it accepts the cookie the website
 * sends AND the bearer token the mobile app sends. With auth() alone
 * every one of these endpoints answered 401 to the app, which is why
 * the customer half of it could not load anything.
 */
async function requireUser() {
  const session = await requireSession();
  return session.user.id;
}

export async function GET(req: Request) {
  try {
    const userId = await requireUser();

    // The website only needs the ids — it already has the businesses on
    // the page and uses these to fill in the heart icons. A phone has
    // nothing cached, so ?expand=1 returns the records themselves
    // rather than making it fetch each one.
    const expand = new URL(req.url).searchParams.get("expand") === "1";
    if (expand) {
      const rows = await getFavorites(userId);
      return ok({ favorites: rows.map((r) => ({ ...r.business, savedAt: r.createdAt })) });
    }

    const favorites = await db.favorite.findMany({
      where: { userId },
      select: { businessId: true },
    });

    return ok({ businessIds: favorites.map((f) => f.businessId) });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[favorites GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();

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
    if (e instanceof Response) return e;
    log.error("[favorites POST]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireUser();

    const businessId = new URL(req.url).searchParams.get("businessId");
    if (!businessId) return err("اختار النشاط الأول", 400);

    // deleteMany, not delete: removing something already gone should
    // not be an error, so the button is safe to press twice.
    await db.favorite.deleteMany({ where: { userId, businessId } });

    return ok({ removed: true });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[favorites DELETE]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
