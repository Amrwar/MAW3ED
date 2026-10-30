import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { canEditCompoundGates } from "@/lib/venues/access";
import { gateSchema } from "@/lib/venues/rules";
import { handle, readJson, sentOnly, venueAudit } from "@/lib/venues/route";

type Ctx = { params: Promise<{ id: string; gateId: string }> };

/**
 * The gate must be this venue's, or its compound's — and a compound
 * gate needs authority over the compound. Anything else is 404.
 */
async function gateFor(id: string, gateId: string) {
  const access = await requireVenueAccess(id, "venue.gates");
  const gate = await db.venueGate.findUnique({ where: { id: gateId } });
  if (!gate) throw err("غير موجود", 404);
  if (gate.venueId === id) return { ...access, gate };
  if (gate.compoundId && gate.compoundId === access.venue.compoundId) {
    const compound = await db.compound.findUniqueOrThrow({ where: { id: gate.compoundId }, select: { id: true, organizationId: true } });
    if (canEditCompoundGates(access.caller, compound)) return { ...access, gate };
  }
  throw err("غير موجود", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  return handle("venue gate PATCH", async () => {
    const { id, gateId } = await params;
    const { caller, authority } = await gateFor(id, gateId);
    const raw = await readJson(req);
    const parsed = gateSchema.partial().safeParse(raw);
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    await db.venueGate.update({ where: { id: gateId }, data: sentOnly(raw, parsed.data) });
    await venueAudit(caller, authority, "venue.gate.edit", id, "عدّل بوابة", { gateId });
    return ok({ saved: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle("venue gate DELETE", async () => {
    const { id, gateId } = await params;
    const { caller, authority } = await gateFor(id, gateId);
    await db.venueGate.delete({ where: { id: gateId } });
    await venueAudit(caller, authority, "venue.gate.delete", id, "حذف بوابة", { gateId });
    return ok({ deleted: true });
  });
}
