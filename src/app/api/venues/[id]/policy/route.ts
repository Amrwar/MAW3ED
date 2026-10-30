import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { policySchema } from "@/lib/venues/rules";
import { handle, readJson, venueAudit } from "@/lib/venues/route";

/**
 * PUT /api/venues/:id/policy — visitor eligibility, access window,
 * guests, re-entry, allowed gates and the published instructions.
 *
 * Configuration only. Nothing here lets anybody in: it is what the
 * public page explains and what a future visitor-access service reads.
 * Allowed gates must be this venue's or its compound's.
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue policy PUT", async () => {
    const { id } = await params;
    const { caller, venue, authority } = await requireVenueAccess(id, "venue.policy");
    const parsed = policySchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const data = parsed.data;

    if (data.allowedGateIds.length) {
      const owned = await db.venueGate.count({
        where: {
          id: { in: data.allowedGateIds },
          OR: [{ venueId: id }, ...(venue.compoundId ? [{ compoundId: venue.compoundId }] : [])],
        },
      });
      if (owned !== new Set(data.allowedGateIds).size) return err("بوابة مش تبع المكان ده", 422);
    }

    const policy = await db.venuePolicy.upsert({
      where: { venueId: id },
      create: { ...data, venueId: id, updatedById: caller.userId },
      update: { ...data, updatedById: caller.userId },
    });
    await venueAudit(caller, authority, "venue.policy", id, "عدّل سياسة دخول الزوار", {
      visitorEligibility: data.visitorEligibility,
    });
    return ok({ policy });
  });
}
