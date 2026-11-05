import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { orgHandle, readJson } from "@/lib/organizations/route";

/**
 * GET/PUT/DELETE /api/admin/organizations/:id/contract — what the platform
 * agreed with an organization: limits on its enterprise tools. No prices:
 * the commercial terms live in the signed contract named by `reference`
 * (docs/enterprise/ONBOARDING.md). Platform administrators only.
 */
const body = z.object({
  reference: z.string().trim().min(2).max(80),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  maxApiClients: z.number().int().min(0).max(20),
  maxWebhooks: z.number().int().min(0).max(20),
  apiRequestsPerMinute: z.number().int().min(10).max(6000),
  notes: z.string().trim().max(500).nullable().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin org contract GET", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    return ok({ contract: await db.organizationContract.findUnique({ where: { organizationId: id } }) });
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin org contract PUT", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const d = parsed.data;
    const startsAt = new Date(d.startsAt);
    const endsAt = d.endsAt ? new Date(d.endsAt) : null;
    if (endsAt && endsAt <= startsAt) return err("نهاية الاتفاق لازم تكون بعد بدايته", 422, { code: "invalid" });
    const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
    if (!org) return err("غير موجود", 404);
    const data = {
      reference: d.reference, startsAt, endsAt, maxApiClients: d.maxApiClients, maxWebhooks: d.maxWebhooks,
      apiRequestsPerMinute: d.apiRequestsPerMinute, notes: d.notes ?? null, setById: actor.id,
    };
    const contract = await db.organizationContract.upsert({ where: { organizationId: id }, create: { organizationId: id, ...data }, update: data });
    await recordAudit({
      actor,
      action: "org.contract.set",
      resourceType: "Organization",
      resourceId: id,
      summary: `Contract ${d.reference} set: ${d.maxApiClients} API keys, ${d.maxWebhooks} webhooks, ${d.apiRequestsPerMinute}/min`,
      metadata: { reference: d.reference, startsAt: d.startsAt, endsAt: d.endsAt ?? null, maxApiClients: d.maxApiClients, maxWebhooks: d.maxWebhooks, apiRequestsPerMinute: d.apiRequestsPerMinute },
    });
    return ok({ contract });
  });
}

/** Ends the contract now: API keys stop working (403 no-contract), webhooks stop. Nothing is deleted. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("admin org contract DELETE", async () => {
    const actor = await requireAdminApi("venues.manage");
    if (!actor) return adminNotFound();
    const { id } = await params;
    const now = new Date();
    const { count } = await db.organizationContract.updateMany({ where: { organizationId: id, startsAt: { lt: now } }, data: { endsAt: now } });
    if (count === 0) return err("مفيش اتفاق ساري", 404);
    await recordAudit({ actor, action: "org.contract.end", resourceType: "Organization", resourceId: id, summary: "Contract ended" });
    return ok({ ok: true });
  });
}
