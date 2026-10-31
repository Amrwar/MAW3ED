import { requireBusinessAccess } from "@/lib/business-access";
import { db } from "@/lib/db";
import { businessUpdateSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

/** GET /api/business — current user's business with relations */
export async function GET() {
  try {
    // The full record (plan, notification addresses, payment settings…)
    // is the owner's: owner only, as before delegation existed.
    const { business } = await requireBusiness().catch(() => ({
      business: null,
    }));
    if (!business) return err("لم يتم العثور على عملك", 404);

    const full = await db.business.findUnique({
      where: { id: business.id },
      include: {
        category: true,
        city:     true,
        services: { orderBy: { sortOrder: "asc" } },
        availability: { orderBy: { dayOfWeek: "asc" } },
        _count: { select: { bookings: true, customers: true } },
      },
    });

    return ok(full);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/** PUT /api/business — update business profile */
export async function PUT(req: Request) {
  try {
    const { business } = await requireBusinessAccess("profile.manage");
    const body = await req.json();
    const parsed = businessUpdateSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const extraData: Record<string, string> = {};
    if (parsed.data.categoryId) {
      const cat = await db.category.findUnique({
        where:  { id: parsed.data.categoryId },
        select: { slug: true },
      });
      extraData.businessType =
        cat?.slug === "restaurants" ? "RESTAURANT"
        : (cat?.slug === "salons" || cat?.slug === "beauty-centers") ? "BARBERSHOP"
        : "GENERAL";
    }

    const updated = await db.business.update({
      where: { id: business.id },
      data:  { ...parsed.data, ...extraData },
    });

    // Only the profile goes back: a PROFILE delegate saves through this
    // route and must not receive the owner's private fields in the reply.
    return ok({
      id: updated.id, slug: updated.slug, nameAr: updated.nameAr, nameEn: updated.nameEn,
      taglineAr: updated.taglineAr, phone: updated.phone, whatsapp: updated.whatsapp, address: updated.address,
      about: updated.about, cityId: updated.cityId, categoryId: updated.categoryId,
      logoImage: updated.logoImage, coverImage: updated.coverImage, businessType: updated.businessType,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business PUT]", e);
    return err("حدث خطأ أثناء التحديث", 500);
  }
}
