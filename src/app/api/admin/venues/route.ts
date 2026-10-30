import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { venueCreateSchema } from "@/lib/venues/admin";
import { handle, readJson } from "@/lib/venues/route";

/**
 * POST /api/admin/venues — a new venue, always created as an
 * unpublished DRAFT. In a compound, it takes the compound's city,
 * district and operator unless told otherwise.
 */
export async function POST(req: Request) {
  return handle("admin venue POST", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const parsed = venueCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const d = parsed.data;
    if (await db.venue.findUnique({ where: { slug: d.slug } })) return err("الرابط مستخدم", 409);

    const compound = d.compoundId
      ? await db.compound.findUnique({ where: { id: d.compoundId }, select: { id: true, cityId: true, neighborhoodId: true, organizationId: true } })
      : null;
    if (d.compoundId && !compound) return err("الكمبوند مش موجود", 422);
    const cityId = d.cityId ?? compound?.cityId;
    if (!cityId) return err("اختار المدينة", 422);
    if (compound && d.cityId && d.cityId !== compound.cityId) return err("المكان لازم يكون في نفس مدينة الكمبوند", 422);

    const venue = await db.venue.create({
      data: {
        slug: d.slug,
        kind: d.kind,
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        cityId,
        neighborhoodId: d.neighborhoodId ?? compound?.neighborhoodId ?? null,
        compoundId: compound?.id ?? null,
        organizationId: d.organizationId ?? compound?.organizationId ?? null,
        status: "DRAFT",
        isPublished: false,
        policy: { create: {} },
      },
    });
    await recordAudit({ actor, action: "venue.create", resourceType: "Venue", resourceId: venue.id, summary: `أضاف المكان "${venue.nameAr}" (مسودة)` });
    return ok({ venue }, 201);
  });
}
