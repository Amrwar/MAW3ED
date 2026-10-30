import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { zoneSchema } from "@/lib/venues/rules";
import { handle, readJson, sentOnly, venueAudit } from "@/lib/venues/route";

type Ctx = { params: Promise<{ id: string; zoneId: string }> };

/**
 * PATCH / DELETE /api/venues/:id/zones/:zoneId
 *
 * Scoped by both ids: a zone id from another venue answers 404. Deleting
 * a zone keeps its tenants listed, just without a floor.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle("venue zone PATCH", async () => {
    const { id, zoneId } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.zones");
    const raw = await readJson(req);
    const parsed = zoneSchema.partial().safeParse(raw);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const { count } = await db.venueZone.updateMany({ where: { id: zoneId, venueId: id }, data: sentOnly(raw, parsed.data) });
    if (!count) return err("غير موجود", 404);
    await venueAudit(caller, authority, "venue.zone.edit", id, "عدّل دور/منطقة", { zoneId });
    return ok({ saved: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle("venue zone DELETE", async () => {
    const { id, zoneId } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.zones");
    const { count } = await db.venueZone.deleteMany({ where: { id: zoneId, venueId: id } });
    if (!count) return err("غير موجود", 404);
    await venueAudit(caller, authority, "venue.zone.delete", id, "حذف دور/منطقة", { zoneId });
    return ok({ deleted: true });
  });
}
