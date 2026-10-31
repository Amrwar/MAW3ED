import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { recordAudit } from "@/lib/admin/audit";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * POST /api/organizations/:id/members — the owner appoints a manager.
 * The account must exist with a confirmed email (an unconfirmed address
 * could belong to anyone). Managers cannot appoint managers.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org members POST", async () => {
    const { id } = await params;
    const { caller, organization, authority } = await requireOrgAccess(id, "org.members");
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("إيميل غير صالح", 422);
    // Charged per well-formed lookup: it is the answer "has an account /
    // has not" that the limit slows down, not typing mistakes.
    const limited = await rateLimit("orgMember", caller.userId);
    if (!limited.ok) return tooManyRequests(limited);
    const user = await db.user.findFirst({
      where: { email: { equals: parsed.data.email, mode: "insensitive" } },
      select: { id: true, name: true, emailVerified: true },
    });
    if (!user) return err("مفيش حساب بالإيميل ده. لازم الشخص يسجّل الأول.", 404, { code: "no-account" });
    if (!user.emailVerified) return err("الحساب ده لسه ما أكّدش إيميله.", 409, { code: "email-not-verified" });
    // The organization's owner already holds every manager permission; a
    // second role row for them would only be a duplicate authority —
    // whoever is adding them (the owner, or a platform administrator).
    const isOwner = await db.venueRole.count({ where: { organizationId: id, userId: user.id, kind: "ORGANIZATION_OWNER" } });
    if (isOwner) return err("الشخص ده مالك الجهة بالفعل", 409, { code: "already-owner" });
    try {
      const role = await db.venueRole.create({
        data: { userId: user.id, kind: "ORGANIZATION_ADMIN", organizationId: id, grantedById: caller.userId },
        select: { id: true },
      });
      await recordAudit({
        actor: null, action: "org.member.add", resourceType: "Organization", resourceId: id,
        summary: `أضاف ${user.name ?? "مستخدم"} كمدير للجهة "${organization.nameAr}"`,
        metadata: { byUserId: caller.userId, authority, userId: user.id },
      });
      return ok({ role }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err("الدور ده موجود بالفعل", 409);
      throw e;
    }
  });
}
