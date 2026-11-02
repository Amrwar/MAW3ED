import { z } from "zod";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { decideMembership } from "@/lib/venues/memberships";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { venueAccessChanged } from "@/lib/access/venue-desk";

const schema = z.object({
  decision: z.enum(["approve", "reject", "remove", "place"]),
  zoneId: z.string().min(1).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * PATCH /api/venues/:id/memberships/:membershipId
 *
 * The venue's decision on a business asking to be listed — approve,
 * reject, remove — or where it is (zone, unit). Only for memberships of
 * this venue; a zone must be one of this venue's.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  return handle("venue membership PATCH", async () => {
    const { id, membershipId } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.memberships.decide");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    await decideMembership({ venueId: id, membershipId, userId: caller.userId, ...parsed.data });
    await venueAudit(caller, authority, `venue.membership.${parsed.data.decision}`, id, `قرار على عضوية: ${parsed.data.decision}`, {
      membershipId,
      note: parsed.data.note ?? null,
    });
    // A tenant no longer listed holds its visitors' passes; one listed again releases them.
    venueAccessChanged(id);
    return ok({ saved: true });
  });
}
