import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { loadVenueCaller } from "@/lib/venues/guard";
import { organizationsFor } from "@/lib/organizations/guard";
import { orgRegisterSchema } from "@/lib/organizations/rules";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { recordAudit } from "@/lib/admin/audit";

/**
 * GET  /api/organizations — the organizations the caller owns or manages.
 * POST /api/organizations — register a new one.
 *
 * Anyone signed in with a confirmed email may register an organization
 * (a mall, compound, business group, franchise, building…). It is
 * created PENDING and private: a platform administrator reviews it
 * before it can recruit businesses or publish a page, so nobody gains
 * standing just by typing a name. The registrant becomes its OWNER.
 */
export async function GET() {
  return orgHandle("organizations GET", async () => {
    const caller = await loadVenueCaller();
    if (!caller) return err("سجّل دخولك الأول", 401);
    return ok({ organizations: await organizationsFor(caller) });
  });
}

export async function POST(req: Request) {
  return orgHandle("organizations POST", async () => {
    const caller = await loadVenueCaller();
    if (!caller) return err("سجّل دخولك الأول", 401);
    const user = await db.user.findUnique({ where: { id: caller.userId }, select: { emailVerified: true, name: true } });
    if (!user?.emailVerified) return err("أكّد إيميلك الأول عشان تسجّل جهة", 403, { code: "email-not-verified" });

    const limited = await rateLimit("orgRegister", caller.userId);
    if (!limited.ok) return tooManyRequests(limited);

    const parsed = orgRegisterSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const d = parsed.data;
    if (await db.organization.findUnique({ where: { slug: d.slug }, select: { id: true } })) return err("الرابط مستخدم", 409);

    const organization = await db.organization.create({
      data: {
        ...d,
        status: "PENDING",
        isPublished: false,
        createdById: caller.userId,
        roles: { create: { userId: caller.userId, kind: "ORGANIZATION_OWNER", grantedById: caller.userId } },
      },
      select: { id: true, slug: true, nameAr: true, status: true },
    });
    await recordAudit({
      actor: null,
      action: "org.register",
      resourceType: "Organization",
      resourceId: organization.id,
      summary: `${user.name ?? "مستخدم"} سجّل الجهة "${organization.nameAr}" (قيد المراجعة)`,
      metadata: { byUserId: caller.userId, kind: d.kind },
    });
    return ok({ organization }, 201);
  });
}
