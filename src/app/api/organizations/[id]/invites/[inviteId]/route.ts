import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";

/** DELETE /api/organizations/:id/invites/:inviteId — cancel an unused invitation. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  return orgHandle("org invite DELETE", async () => {
    const { id, inviteId } = await params;
    await requireOrgAccess(id, "org.associations.manage");
    const { count } = await db.organizationInvite.updateMany({
      where: { id: inviteId, organizationId: id, acceptedBusinessId: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    if (!count) return err("غير موجود", 404);
    return ok({ cancelled: true });
  });
}
