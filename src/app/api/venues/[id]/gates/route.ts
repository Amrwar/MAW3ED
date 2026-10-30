import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { canEditCompoundGates } from "@/lib/venues/access";
import { gateSchema } from "@/lib/venues/rules";
import { handle, readJson, venueAudit } from "@/lib/venues/route";

const bodySchema = gateSchema.extend({ scope: z.enum(["venue", "compound"]).default("venue") });

/**
 * POST /api/venues/:id/gates — an entry point, as information only.
 *
 * A gate on the venue is the venue's to add. A gate on the compound
 * serves every venue in it, so it needs authority over the compound.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue gates POST", async () => {
    const { id } = await params;
    const { caller, venue, authority } = await requireVenueAccess(id, "venue.gates");
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const { scope, ...data } = parsed.data;

    if (scope === "compound") {
      if (!venue.compoundId) return err("المكان ده مش في كمبوند", 422);
      const compound = await db.compound.findUniqueOrThrow({ where: { id: venue.compoundId }, select: { id: true, organizationId: true } });
      if (!canEditCompoundGates(caller, compound)) return err("غير موجود", 404);
      const gate = await db.venueGate.create({ data: { ...data, compoundId: compound.id } });
      await venueAudit(caller, authority, "compound.gate.create", id, `أضاف بوابة للكمبوند "${gate.nameAr}"`, { gateId: gate.id });
      return ok({ gate }, 201);
    }
    const gate = await db.venueGate.create({ data: { ...data, venueId: id } });
    await venueAudit(caller, authority, "venue.gate.create", id, `أضاف بوابة "${gate.nameAr}"`, { gateId: gate.id });
    return ok({ gate }, 201);
  });
}
