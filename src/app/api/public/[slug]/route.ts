import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";

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

    // Fetch resource data based on businessType
    let tables: object[] = [];
    let staffMembers: object[] = [];

    if (business.businessType === "RESTAURANT") {
      tables = await db.table.findMany({
        where:   { businessId: business.id, isActive: true },
        select:  { id: true, name: true, tableType: true, capacity: true, notes: true, photo: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (business.businessType === "BARBERSHOP") {
      const staff = await db.staffMember.findMany({
        where:   { businessId: business.id, isActive: true },
        select:  { id: true, nameAr: true, nameEn: true, role: true, photo: true, services: { select: { serviceId: true } } },
        orderBy: { createdAt: "asc" },
      });
      staffMembers = staff.map((s) => ({
        id:         s.id,
        nameAr:     s.nameAr,
        nameEn:     s.nameEn,
        role:       s.role,
        photo:      s.photo,
        serviceIds: s.services.map((ss) => ss.serviceId),
      }));
    }

    // Strip owner info before returning
    const { ownerId: _, ...safe } = business as typeof business & { ownerId: string };

    return ok({ ...safe, tables, staffMembers });
  } catch (e) {
    log.error("[public slug]", e);
    return err("حدث خطأ", 500);
  }
}
