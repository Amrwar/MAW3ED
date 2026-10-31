import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { loadVenueCaller } from "@/lib/venues/guard";
import { orgAuthorityOver } from "@/lib/organizations/access";
import { setParentOrganization } from "@/lib/organizations/associations";
import { orgHandle, readJson } from "@/lib/organizations/route";

const schema = z.object({ parentId: z.string().min(1).max(40).nullable() });

/**
 * PUT /api/organizations/:id/parent — put this organization under a
 * parent organization, or take it out (`parentId: null`). Linking needs
 * ownership of both; unlinking, ownership of either (the parent's owner
 * may detach a child it no longer wants to list). Cycles and more than
 * three levels are refused. Anybody else: 404.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org parent PUT", async () => {
    const { id } = await params;
    const caller = await loadVenueCaller();
    if (!caller) return err("سجّل دخولك الأول", 401);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    const child = await db.organization.findUnique({ where: { id }, select: { parentId: true } });
    if (!child) return err("غير موجود", 404);
    // The other side: the new parent when linking, the current one when unlinking.
    const otherId = parsed.data.parentId ?? child.parentId;
    await setParentOrganization({
      childId: id,
      parentId: parsed.data.parentId,
      byUserId: caller.userId,
      childAuthority: orgAuthorityOver(caller, id),
      parentAuthority: otherId ? orgAuthorityOver(caller, otherId) : null,
    });
    return ok({ saved: true });
  });
}
