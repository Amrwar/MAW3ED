import { z } from "zod";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgAuthorityOver } from "@/lib/organizations/access";
import { setParentOrganization } from "@/lib/organizations/associations";
import { orgHandle, readJson } from "@/lib/organizations/route";

const schema = z.object({ parentId: z.string().min(1).max(40).nullable() });

/**
 * PUT /api/organizations/:id/parent — put this organization under a
 * parent organization, or take it out (`parentId: null`). Linking needs
 * ownership of both; cycles and more than three levels are refused.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org parent PUT", async () => {
    const { id } = await params;
    // Owner-level on this organization (managers cannot reorganize ownership).
    const { caller, authority } = await requireOrgAccess(id, "org.members");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    await setParentOrganization({
      childId: id,
      parentId: parsed.data.parentId,
      byUserId: caller.userId,
      childAuthority: authority,
      parentAuthority: parsed.data.parentId ? orgAuthorityOver(caller, parsed.data.parentId) : null,
    });
    return ok({ saved: true });
  });
}
