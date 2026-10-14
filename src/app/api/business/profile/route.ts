import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { log } from "@/lib/logger";

/**
 * GET /api/business/profile — the business as its team sees it in the app.
 *
 * The public face plus what the team works from: name, category, city,
 * contact, address, opening hours, branches and the public link. Not the
 * owner's settings (plan, payments, notification channels): GET
 * /api/business has those, for the owner only. Editing stays on the web
 * dashboard.
 */
export async function GET() {
  try {
    const { business } = await requireBusinessAccess("profile.read");

    const full = await db.business.findUnique({
      where: { id: business.id },
      select: {
        id: true,
        slug: true,
        nameAr: true,
        nameEn: true,
        phone: true,
        whatsapp: true,
        address: true,
        logoImage: true,
        coverImage: true,
        isPublished: true,
        autoConfirm: true,
        ratingAvg: true,
        ratingCount: true,
        category: { select: { nameAr: true, nameEn: true } },
        city: { select: { nameAr: true, nameEn: true } },
        availability: { orderBy: { dayOfWeek: "asc" } },
        branches: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, nameAr: true, nameEn: true, address: true },
        },
      },
    });
    if (!full) return err("لم يتم العثور على عملك", 404);
    return ok(full);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business profile GET]", e);
    return err("حدث خطأ", 500);
  }
}
