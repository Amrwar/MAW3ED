import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/[slug]
 * Public endpoint — returns business profile + services + availability.
 * No auth required.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { slug } = await params;

    const business = await db.business.findUnique({
      where:   { slug, isPublished: true },
      include: {
        category: true,
        city:     true,
        services: {
          where:   { isAvailable: true },
          orderBy: { sortOrder: "asc" },
        },
        availability: { orderBy: { dayOfWeek: "asc" } },
        _count: { select: { bookings: true } },
      },
    });

    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    // Strip owner info before returning
    const { ownerId: _, ...safe } = business as typeof business & { ownerId: string };

    return ok(safe);
  } catch (e) {
    console.error("[public slug]", e);
    return err("حدث خطأ", 500);
  }
}
