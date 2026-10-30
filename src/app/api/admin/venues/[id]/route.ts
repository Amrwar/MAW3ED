import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { venueAdminPatchSchema } from "@/lib/venues/admin";
import { handle, readJson } from "@/lib/venues/route";

/**
 * PATCH /api/admin/venues/:id — status, publishing and where the venue
 * belongs. Only a platform administrator puts a venue in front of the
 * public; publishing a venue that is not ACTIVE is refused.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("admin venue PATCH", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const parsed = venueAdminPatchSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const before = await db.venue.findUnique({ where: { id }, select: { status: true, isPublished: true, organizationId: true, compoundId: true, nameAr: true, cityId: true } });
    if (!before) return adminNotFound();
    const d = parsed.data;

    const status = d.status ?? before.status;
    // Suspending takes it down; publishing needs it ACTIVE.
    const isPublished = status !== "ACTIVE" ? false : (d.isPublished ?? before.isPublished);
    if (d.isPublished && status !== "ACTIVE") return err("لازم المكان يكون مفعّل قبل النشر", 409);
    if (d.organizationId && !(await db.venueOrganization.findUnique({ where: { id: d.organizationId }, select: { id: true } }))) {
      return err("الجهة مش موجودة", 422);
    }
    let organizationId = d.organizationId;
    if (d.compoundId) {
      const c = await db.compound.findUnique({ where: { id: d.compoundId }, select: { cityId: true, organizationId: true } });
      if (!c) return err("الكمبوند مش موجود", 422);
      if (c.cityId !== before.cityId) return err("الكمبوند في مدينة تانية", 422);
      // A venue moved into a compound joins the compound's operator,
      // unless an operator was named explicitly.
      if (organizationId === undefined && c.organizationId) organizationId = c.organizationId;
    }
    if (d.compoundId !== undefined && d.compoundId !== before.compoundId) {
      // The old compound's gates no longer serve this venue: drop them
      // from the allowed list rather than keep ids that match nothing.
      const policy = await db.venuePolicy.findUnique({ where: { venueId: id }, select: { allowedGateIds: true } });
      if (policy?.allowedGateIds.length) {
        const still = await db.venueGate.findMany({
          where: { id: { in: policy.allowedGateIds }, OR: [{ venueId: id }, ...(d.compoundId ? [{ compoundId: d.compoundId }] : [])] },
          select: { id: true },
        });
        await db.venuePolicy.update({ where: { venueId: id }, data: { allowedGateIds: still.map((g) => g.id) } });
      }
    }

    const after = await db.venue.update({
      where: { id },
      data: { ...d, ...(organizationId !== undefined ? { organizationId } : {}), status, isPublished },
      select: { status: true, isPublished: true, organizationId: true, compoundId: true },
    });
    await recordAudit({
      actor,
      action: "venue.admin",
      resourceType: "Venue",
      resourceId: id,
      summary: `غيّر حالة المكان "${before.nameAr}"`,
      metadata: {
        from: { status: before.status, isPublished: before.isPublished, organizationId: before.organizationId, compoundId: before.compoundId },
        to: after,
      },
    });
    return ok({ venue: after });
  });
}
