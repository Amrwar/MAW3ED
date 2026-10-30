import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { compoundCreateSchema } from "@/lib/venues/admin";
import { handle, readJson } from "@/lib/venues/route";

/** POST /api/admin/compounds — a compound in a city (and district). */
export async function POST(req: Request) {
  return handle("admin compound POST", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const parsed = compoundCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const d = parsed.data;
    if (await db.compound.findUnique({ where: { slug: d.slug } })) return err("الرابط مستخدم", 409);
    if (d.organizationId && !(await db.venueOrganization.findUnique({ where: { id: d.organizationId }, select: { id: true } }))) {
      return err("الجهة مش موجودة", 422);
    }
    if (!(await db.city.findUnique({ where: { id: d.cityId }, select: { id: true } }))) return err("المدينة مش موجودة", 422);
    if (d.neighborhoodId) {
      const n = await db.neighborhood.findFirst({ where: { id: d.neighborhoodId, cityId: d.cityId }, select: { id: true } });
      if (!n) return err("الحي مش في المدينة دي", 422);
    }
    const compound = await db.compound.create({ data: { ...d, organizationId: d.organizationId ?? null, neighborhoodId: d.neighborhoodId ?? null } });
    await recordAudit({ actor, action: "compound.create", resourceType: "Compound", resourceId: compound.id, summary: `أضاف الكمبوند "${compound.nameAr}"` });
    return ok({ compound }, 201);
  });
}
