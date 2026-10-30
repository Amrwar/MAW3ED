import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { organizationCreateSchema } from "@/lib/venues/admin";
import { handle, readJson } from "@/lib/venues/route";

/** POST /api/admin/venue-organizations — an operator, as data the operator supplied. */
export async function POST(req: Request) {
  return handle("admin venue org POST", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const parsed = organizationCreateSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    if (await db.organization.findUnique({ where: { slug: parsed.data.slug } })) return err("الرابط مستخدم", 409);
    const org = await db.organization.create({ data: parsed.data });
    await recordAudit({ actor, action: "venue.organization.create", resourceType: "VenueOrganization", resourceId: org.id, summary: `أضاف الجهة "${org.nameAr}"` });
    return ok({ organization: org }, 201);
  });
}
