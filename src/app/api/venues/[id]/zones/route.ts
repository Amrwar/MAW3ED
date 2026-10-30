import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { zoneSchema } from "@/lib/venues/rules";
import { handle, readJson, venueAudit } from "@/lib/venues/route";

/** POST /api/venues/:id/zones — add a floor, zone or wing. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue zones POST", async () => {
    const { id } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.zones");
    const parsed = zoneSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const zone = await db.venueZone.create({ data: { ...parsed.data, venueId: id } });
    await venueAudit(caller, authority, "venue.zone.create", id, `أضاف "${zone.nameAr}"`, { zoneId: zone.id });
    return ok({ zone }, 201);
  });
}
