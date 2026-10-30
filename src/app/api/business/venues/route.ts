import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireBusiness } from "@/lib/api";
import { handle } from "@/lib/venues/route";

/**
 * GET /api/business/venues — for the owner: venues that take requests,
 * this business's branches, and its memberships with their status.
 * Only venue names and places are shown; nothing about other tenants.
 */
export async function GET() {
  return handle("business venues GET", async () => {
    const { business } = await requireBusiness();
    const [venues, branches, memberships] = await Promise.all([
      db.venue.findMany({
        where: { status: "ACTIVE" },
        orderBy: { nameAr: "asc" },
        select: {
          id: true, slug: true, nameAr: true, nameEn: true, isPublished: true,
          city: { select: { nameAr: true, nameEn: true } },
          compound: { select: { nameAr: true, nameEn: true } },
        },
      }),
      db.branch.findMany({
        where: { businessId: business.id, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, nameAr: true, nameEn: true },
      }),
      db.venueMembership.findMany({
        where: { businessId: business.id },
        orderBy: { requestedAt: "desc" },
        select: {
          id: true, status: true, unit: true, requestedAt: true, decidedAt: true, decisionNote: true,
          venue: { select: { id: true, slug: true, nameAr: true, nameEn: true, isPublished: true, status: true } },
          branch: { select: { nameAr: true, nameEn: true } },
          zone: { select: { nameAr: true, nameEn: true } },
        },
      }),
    ]);
    return ok({
      venues,
      branches,
      memberships: memberships.map((m) => ({
        ...m,
        requestedAt: m.requestedAt.toISOString(),
        decidedAt: m.decidedAt?.toISOString() ?? null,
      })),
    });
  });
}
