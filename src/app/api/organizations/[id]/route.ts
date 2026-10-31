import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgCan } from "@/lib/organizations/access";
import { orgProfileSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { recordAudit } from "@/lib/admin/audit";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/organizations/:id — everything the organization console shows. */
export async function GET(_req: Request, { params }: Ctx) {
  return orgHandle("organization GET", async () => {
    const { id } = await params;
    const { authority } = await requireOrgAccess(id, "org.view");
    const org = await db.organization.findUniqueOrThrow({
      where: { id },
      include: {
        city: { select: { id: true, nameAr: true, nameEn: true } },
        venues: {
          orderBy: { createdAt: "desc" },
          select: { id: true, slug: true, nameAr: true, nameEn: true, status: true, isPublished: true },
        },
        roles: {
          where: { kind: { in: ["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN"] } },
          select: { id: true, kind: true, user: { select: { name: true, email: true } } },
        },
        invites: {
          where: { cancelledAt: null, acceptedBusinessId: null, expiresAt: { gt: new Date() } },
          select: { id: true, email: true, relation: true, token: true, expiresAt: true },
        },
      },
    });
    return ok({
      organization: org,
      authority,
      can: {
        edit: orgCan(authority, "org.edit"),
        publish: orgCan(authority, "org.publish"),
        members: orgCan(authority, "org.members"),
        review: orgCan(authority, "org.review"),
      },
    });
  });
}

const patchSchema = z.object({
  profile: orgProfileSchema.optional(),
  isPublished: z.boolean().optional(),
});

/**
 * PATCH /api/organizations/:id — the profile (owner or manager), and
 * publishing (owner only, and only once the platform has APPROVED it).
 */
export async function PATCH(req: Request, { params }: Ctx) {
  return orgHandle("organization PATCH", async () => {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const { profile, isPublished } = parsed.data;
    if (!profile && isPublished === undefined) return err("مفيش حاجة تتغير", 422);

    if (profile && Object.keys(profile).length) {
      const { caller, organization, authority } = await requireOrgAccess(id, "org.edit");
      if (profile.cityId && !(await db.city.findUnique({ where: { id: profile.cityId }, select: { id: true } }))) {
        return err("المدينة مش موجودة", 422);
      }
      await db.organization.update({ where: { id }, data: profile });
      await recordAudit({
        actor: null, action: "org.edit", resourceType: "Organization", resourceId: id,
        summary: `تعديل بيانات الجهة "${organization.nameAr}"`,
        metadata: { byUserId: caller.userId, authority, fields: Object.keys(profile) },
      });
    }
    if (isPublished !== undefined) {
      const { caller, organization, authority } = await requireOrgAccess(id, "org.publish");
      if (isPublished && organization.status !== "APPROVED") {
        return err("لازم موعد يراجع الجهة ويعتمدها قبل النشر", 409, { code: "not-approved" });
      }
      await db.organization.update({ where: { id }, data: { isPublished: isPublished && organization.status === "APPROVED" } });
      await recordAudit({
        actor: null, action: isPublished ? "org.publish" : "org.unpublish", resourceType: "Organization", resourceId: id,
        summary: `${isPublished ? "نشر" : "إخفاء"} صفحة الجهة "${organization.nameAr}"`,
        metadata: { byUserId: caller.userId, authority },
      });
    }
    return ok({ saved: true });
  });
}
