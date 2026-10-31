import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { requestToJoin } from "@/lib/organizations/associations";
import { orgHandle, readJson } from "@/lib/organizations/route";

/**
 * GET  /api/business/organizations — for the owner: organizations that
 * accept requests, this business's branches, and its own associations
 * (invitations included).
 * POST /api/business/organizations — ask to join one.
 *
 * Owner only. Joining is always optional and never moves ownership.
 */
export async function GET() {
  return orgHandle("business organizations GET", async () => {
    const { business } = await requireBusiness();
    const [organizations, branches, associations] = await Promise.all([
      db.organization.findMany({
        where: { status: "APPROVED" },
        orderBy: { nameAr: "asc" },
        select: { id: true, slug: true, kind: true, nameAr: true, nameEn: true, isPublished: true, logoImage: true, city: { select: { nameAr: true, nameEn: true } } },
      }),
      db.branch.findMany({
        where: { businessId: business.id, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, nameAr: true, nameEn: true },
      }),
      db.organizationBusiness.findMany({
        where: { businessId: business.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, status: true, relation: true, note: true, createdAt: true, decidedAt: true,
          branch: { select: { nameAr: true, nameEn: true } },
          organization: { select: { id: true, slug: true, kind: true, nameAr: true, nameEn: true, isPublished: true, status: true } },
        },
      }),
    ]);
    return ok({
      organizations,
      branches,
      associations: associations.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), decidedAt: a.decidedAt?.toISOString() ?? null })),
    });
  });
}

const schema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request) {
  return orgHandle("business organizations POST", async () => {
    const { session, business } = await requireBusiness();
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    const row = await requestToJoin({
      businessId: business.id,
      userId: session.user.id,
      organizationId: parsed.data.organizationId,
      branchId: parsed.data.branchId ?? null,
    });
    return ok({ association: row }, 201);
  });
}
