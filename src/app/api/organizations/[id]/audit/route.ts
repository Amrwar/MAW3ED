import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";

/** GET /api/organizations/:id/audit — this organization's own trail. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org audit GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.audit");
    const entries = await db.auditLog.findMany({
      where: { resourceType: "Organization", resourceId: id },
      orderBy: { at: "desc" },
      take: 50,
      select: { id: true, action: true, summary: true, at: true, actorRole: true },
    });
    return ok({ entries: entries.map((e) => ({ ...e, at: e.at.toISOString() })) });
  });
}
