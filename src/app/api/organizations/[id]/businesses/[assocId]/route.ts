import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { decideAssociation } from "@/lib/organizations/associations";
import { associationDecisionSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";

/**
 * PATCH /api/organizations/:id/businesses/:assocId — approve or reject
 * a request, remove a listed business (its data stays its own), or
 * organize it (section, order, relation).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; assocId: string }> }) {
  return orgHandle("org business PATCH", async () => {
    const { id, assocId } = await params;
    const action = associationDecisionSchema.safeParse(await readJson(req));
    if (!action.success) return err(action.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const needed = action.data.action === "organize" ? "org.directory.organize" : "org.associations.manage";
    const { caller, authority } = await requireOrgAccess(id, needed);
    await decideAssociation({
      organizationId: id,
      associationId: assocId,
      byUserId: caller.userId,
      authority,
      action: action.data.action,
      section: action.data.section,
      sortOrder: action.data.sortOrder,
      relation: action.data.relation,
      note: action.data.note,
    });
    return ok({ saved: true });
  });
}
