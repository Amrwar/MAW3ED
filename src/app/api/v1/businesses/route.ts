import { db } from "@/lib/db";
import { apiHandle, decodeCursor, encodeCursor, pageParams, requireApiClient } from "@/lib/enterprise/auth";

/**
 * GET /api/v1/businesses?limit=&cursor= — the businesses this organization
 * is associated with (approved), one row per association, with the
 * relationship and what the business granted. Public business fields only.
 */
export async function GET(req: Request) {
  return apiHandle(async () => {
    const c = await requireApiClient(req, "businesses:read");
    const { limit, cursor } = pageParams(req);
    const after = decodeCursor(cursor)?.[0];
    const rows = await db.organizationBusiness.findMany({
      where: { organizationId: c.organizationId, status: "APPROVED", ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: {
        id: true, relation: true, scopes: true, branchId: true, section: true, suspendedAt: true, expiresAt: true,
        business: {
          select: { id: true, slug: true, nameAr: true, nameEn: true, isPublished: true, category: { select: { slug: true } }, city: { select: { slug: true } } },
        },
      },
    });
    const page = rows.slice(0, limit);
    return Response.json({
      data: page.map((r) => ({
        associationId: r.id,
        relation: r.relation,
        scopes: r.scopes,
        branchId: r.branchId,
        section: r.section,
        suspended: !!r.suspendedAt,
        expiresAt: r.expiresAt,
        business: {
          id: r.business.id, slug: r.business.slug, nameAr: r.business.nameAr, nameEn: r.business.nameEn,
          isPublished: r.business.isPublished, category: r.business.category?.slug ?? null, city: r.business.city?.slug ?? null,
        },
      })),
      nextCursor: rows.length > limit ? encodeCursor([page[page.length - 1].id]) : null,
    });
  });
}
