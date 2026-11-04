import { db } from "@/lib/db";
import { apiHandle, requireApiClient } from "@/lib/enterprise/auth";

/** GET /api/v1/organization — the calling organization, its contract limits and its key's scopes. */
export async function GET(req: Request) {
  return apiHandle(async () => {
    const c = await requireApiClient(req, "organization:read");
    const org = await db.organization.findUniqueOrThrow({
      where: { id: c.organizationId },
      select: { id: true, slug: true, kind: true, nameAr: true, nameEn: true, isPublished: true, brandColor: true },
    });
    const counts = await db.organizationBusiness.groupBy({
      by: ["relation"],
      where: { organizationId: c.organizationId, status: "APPROVED" },
      _count: { _all: true },
    });
    return Response.json({
      data: {
        ...org,
        relationships: Object.fromEntries(counts.map((x) => [x.relation, x._count._all])),
        contract: { reference: c.contract.reference, endsAt: c.contract.endsAt, apiRequestsPerMinute: c.contract.apiRequestsPerMinute },
        scopes: c.scopes,
      },
    });
  });
}
