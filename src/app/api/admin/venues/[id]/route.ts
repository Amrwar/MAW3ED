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
    if (d.compoundId) {
      const c = await db.compound.findUnique({ where: { id: d.compoundId }, select: { cityId: true } });
      if (!c) return err("الكمبوند مش موجود", 422);
      if (c.cityId !== before.cityId) return err("الكمبوند في مدينة تانية", 422);
    }

    const after = await db.venue.update({
      where: { id },
      data: { ...d, status, isPublished },
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
