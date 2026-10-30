import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { handle } from "@/lib/venues/route";

/** DELETE /api/admin/venue-roles/:id — takes effect on the holder's next request. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("admin venue role DELETE", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const role = await db.venueRole.findUnique({ where: { id }, select: { id: true, kind: true, userId: true } });
    if (!role) return adminNotFound();
    await db.venueRole.delete({ where: { id } });
    await recordAudit({ actor, action: "venue.role.revoke", resourceType: "VenueRole", resourceId: id, summary: `سحب دور ${role.kind}`, metadata: { userId: role.userId } });
    return ok({ deleted: true });
  });
}
