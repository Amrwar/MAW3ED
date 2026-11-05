import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { createApiClient } from "@/lib/enterprise/clients";
import { API_SCOPES } from "@/lib/enterprise/scopes";

/**
 * GET/POST /api/organizations/:id/api-clients — the organization's API keys
 * (docs/enterprise/INTEGRATION_GUIDE.md). Owner only (org.integrations).
 * A new key is in the POST answer once and never again.
 */
const body = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).max(API_SCOPES.length),
});

const WHY: Record<string, [string, number]> = {
  "no-contract": ["مفيش اتفاق ساري مع المنصة يسمح بمفاتيح API", 403],
  limit: ["وصلت للحد الأقصى من المفاتيح في الاتفاق", 409],
  "bad-scopes": ["صلاحيات غير صحيحة", 422],
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org api clients GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.integrations");
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [clients, contract] = await Promise.all([
      db.apiClient.findMany({
        where: { organizationId: id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true, name: true, keyPrefix: true, scopes: true, status: true, expiresAt: true, lastUsedAt: true,
          revokedAt: true, replacedById: true, createdAt: true,
          usage: { where: { day: { gte: since } }, select: { day: true, requests: true }, orderBy: { day: "asc" } },
        },
      }),
      db.organizationContract.findUnique({ where: { organizationId: id } }),
    ]);
    return ok({ clients, contract, scopes: API_SCOPES });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org api clients POST", async () => {
    const { id } = await params;
    const { caller } = await requireOrgAccess(id, "org.integrations");
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const r = await createApiClient(id, parsed.data, { id: caller.userId, name: caller.name });
    if (!r.ok) {
      const [m, s] = WHY[r.why] ?? ["مينفعش", 409];
      return err(m, s, { code: r.why });
    }
    return ok({ id: r.id, prefix: r.prefix, key: r.key }, 201);
  });
}
