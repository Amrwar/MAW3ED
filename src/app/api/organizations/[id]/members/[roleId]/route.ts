import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";
import { recordAudit } from "@/lib/admin/audit";

/**
 * DELETE /api/organizations/:id/members/:roleId — the owner removes a
 * manager. The owner role itself cannot be removed here: the
 * organization must always have its owner (a platform administrator
 * reassigns ownership if it ever has to move).
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; roleId: string }> }) {
  return orgHandle("org member DELETE", async () => {
    const { id, roleId } = await params;
    const { caller, organization, authority } = await requireOrgAccess(id, "org.members");
    const { count } = await db.venueRole.deleteMany({
      where: { id: roleId, organizationId: id, kind: "ORGANIZATION_ADMIN" },
    });
    if (!count) return err("غير موجود", 404);
    await recordAudit({
      actor: null, action: "org.member.remove", resourceType: "Organization", resourceId: id,
      summary: `سحب دور مدير من الجهة "${organization.nameAr}"`,
      metadata: { byUserId: caller.userId, authority, roleId },
    });
    return ok({ deleted: true });
  });
}
