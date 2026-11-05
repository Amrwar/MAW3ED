import { db } from "@/lib/db";
import { apiHandle, decodeCursor, encodeCursor, pageParams, requireApiClient } from "@/lib/enterprise/auth";

/** GET /api/v1/venues?limit=&cursor= — the organization's venues (public fields; visitor access on/off). */
export async function GET(req: Request) {
  return apiHandle(async () => {
    const c = await requireApiClient(req, "venues:read");
    const { limit, cursor } = pageParams(req);
    const after = decodeCursor(cursor)?.[0];
    const rows = await db.venue.findMany({
      where: { organizationId: c.organizationId, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take: limit + 1,
      select: { id: true, slug: true, kind: true, nameAr: true, nameEn: true, status: true, isPublished: true, accessEnabled: true },
    });
    const page = rows.slice(0, limit);
    return Response.json({ data: page, nextCursor: rows.length > limit ? encodeCursor([page[page.length - 1].id]) : null });
  });
}
