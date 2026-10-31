import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { exceptionSchema } from "@/lib/venues/rules";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { venueAccessChanged } from "@/lib/access/venue-desk";

/**
 * POST /api/venues/:id/exceptions — a dated closure, special hours, an
 * access suspension or a booking pause, shown on the public page.
 * Recorded and published; it does not cancel anybody's booking.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue exceptions POST", async () => {
    const { id } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.exceptions");
    const parsed = exceptionSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const d = parsed.data;
    const exception = await db.venueException.create({
      data: {
        venueId: id,
        kind: d.kind,
        startsOn: new Date(`${d.startsOn}T00:00:00Z`),
        endsOn: new Date(`${d.endsOn}T00:00:00Z`),
        openTime: d.openTime ?? null,
        closeTime: d.closeTime ?? null,
        noteAr: d.noteAr,
        noteEn: d.noteEn,
        createdById: caller.userId,
      },
    });
    await venueAudit(caller, authority, "venue.exception.create", id, `استثناء ${d.kind} من ${d.startsOn} لـ ${d.endsOn}`);
    // A notice suspending visitor access (or closing the venue) holds passes for those days.
    venueAccessChanged(id);
    return ok({ exception }, 201);
  });
}
