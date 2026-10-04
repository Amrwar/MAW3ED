import { db } from "@/lib/db";
import { businessUpdateSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";

/** GET /api/business — current user's business with relations */
export async function GET() {
  try {
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
    console.error("[business GET]", e);
    return err("حدث خطأ", 500);
  }
}

/** PUT /api/business — update business profile */
export async function PUT(req: Request) {
  try {
    const { business } = await requireBusiness();
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

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[business PUT]", e);
    return err("حدث خطأ أثناء التحديث", 500);
  }
}
