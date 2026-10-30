import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { venueRoleGrantSchema } from "@/lib/venues/admin";
import { handle, readJson } from "@/lib/venues/route";

/**
 * POST /api/admin/venue-roles — give an existing account authority over
 * an organisation, a compound or one venue.
 *
 * The account must already exist (found by email) and have confirmed
 * that email: anybody can sign up with an address they do not own, and
 * a role granted to that account would hand a stranger the venue.
 * Nothing is created and no invitation is sent. The target must exist. Granting is a
 * platform decision — a venue manager cannot appoint anybody.
 */
export async function POST(req: Request) {
  return handle("admin venue role POST", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const parsed = venueRoleGrantSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const d = parsed.data;

    const user = await db.user.findFirst({
      where: { email: { equals: d.email, mode: "insensitive" } },
      select: { id: true, name: true, emailVerified: true },
    });
    if (!user) return err("مفيش حساب بالإيميل ده. لازم الشخص يسجّل الأول.", 404, { code: "no-account" });
    if (!user.emailVerified) {
      return err("الحساب ده لسه ما أكّدش إيميله. اطلب منه يأكّده الأول.", 409, { code: "email-not-verified" });
    }

    // The schema guarantees exactly one scope id matching the kind
    // (ORGANIZATION_OWNER and ORGANIZATION_ADMIN both carry an
    // organizationId), so branch on the id that is present.
    const exists = d.organizationId
      ? await db.organization.findUnique({ where: { id: d.organizationId }, select: { id: true } })
      : d.compoundId
        ? await db.compound.findUnique({ where: { id: d.compoundId }, select: { id: true } })
        : await db.venue.findUnique({ where: { id: d.venueId! }, select: { id: true } });
    if (!exists) return err("النطاق ده مش موجود", 422);

    try {
      const role = await db.venueRole.create({
        data: {
          userId: user.id,
          kind: d.kind,
          organizationId: d.organizationId ?? null,
          compoundId: d.compoundId ?? null,
          venueId: d.venueId ?? null,
          grantedById: actor.id,
        },
      });
      await recordAudit({
        actor,
        action: "venue.role.grant",
        resourceType: "VenueRole",
        resourceId: role.id,
        summary: `أعطى ${user.name ?? "مستخدم"} دور ${d.kind}`,
        metadata: { userId: user.id, kind: d.kind, organizationId: d.organizationId ?? null, compoundId: d.compoundId ?? null, venueId: d.venueId ?? null },
      });
      return ok({ role }, 201);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return err("الدور ده موجود بالفعل", 409);
      throw e;
    }
  });
}

/** GET /api/admin/venue-roles — every venue role, with the account's name and email. */
export async function GET() {
  return handle("admin venue role GET", async () => {
    const actor = await requireAdminApi("venues.read");
    if (!actor) return adminNotFound();
    const roles = await db.venueRole.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, kind: true, organizationId: true, compoundId: true, venueId: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        organization: { select: { nameAr: true } },
        compound: { select: { nameAr: true } },
        venue: { select: { nameAr: true } },
      },
    });
    return ok({ roles });
  });
}
