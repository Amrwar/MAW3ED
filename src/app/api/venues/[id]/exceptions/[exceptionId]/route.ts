import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { handle, venueAudit } from "@/lib/venues/route";
import { venueAccessChanged } from "@/lib/access/venue-desk";

/** DELETE /api/venues/:id/exceptions/:exceptionId — scoped to the venue. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; exceptionId: string }> }) {
  return handle("venue exception DELETE", async () => {
    const { id, exceptionId } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.exceptions");
    const { count } = await db.venueException.deleteMany({ where: { id: exceptionId, venueId: id } });
    if (!count) return err("غير موجود", 404);
    await venueAudit(caller, authority, "venue.exception.delete", id, "حذف استثناء", { exceptionId });
    venueAccessChanged(id);
    return ok({ deleted: true });
  });
}
