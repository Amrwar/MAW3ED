import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { inviteBusiness, listAssociations } from "@/lib/organizations/associations";
import { inviteBusinessSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/organizations/:id/businesses — associations of this organization only. */
export async function GET(_req: Request, { params }: Ctx) {
  return orgHandle("org businesses GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.view");
    return ok({ associations: await listAssociations(id) });
  });
}

/**
 * POST /api/organizations/:id/businesses — invite an existing business,
 * by its public slug. The business's owner decides; nothing is listed
 * until they accept.
 */
export async function POST(req: Request, { params }: Ctx) {
  return orgHandle("org businesses POST", async () => {
    const { id } = await params;
    const { caller, authority } = await requireOrgAccess(id, "org.associations.manage");
    const parsed = inviteBusinessSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const row = await inviteBusiness({
      organizationId: id,
      byUserId: caller.userId,
      authority,
      businessSlug: parsed.data.businessSlug,
      branchId: parsed.data.branchId ?? null,
      relation: parsed.data.relation,
      note: parsed.data.note ?? null,
    });
    return ok({ association: row }, 201);
  });
}
