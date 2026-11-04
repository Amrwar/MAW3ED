import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { createEndpoint } from "@/lib/enterprise/webhooks";
import { WEBHOOK_EVENTS } from "@/lib/enterprise/scopes";

/**
 * GET/POST /api/organizations/:id/webhooks — where events are sent, and
 * each endpoint's recent deliveries. Owner only. The signing secret is in
 * the POST answer once.
 */
const body = z.object({
  url: z.string().trim().min(10).max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org webhooks GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.integrations");
    const endpoints = await db.webhookEndpoint.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, url: true, events: true, status: true, consecutiveFailures: true, disabledReason: true,
        lastSuccessAt: true, lastFailureAt: true, previousSecretUntil: true, createdAt: true,
        deliveries: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, eventId: true, eventType: true, status: true, attempts: true, lastStatusCode: true, lastError: true, nextAttemptAt: true, deliveredAt: true, createdAt: true },
        },
      },
    });
    return ok({ endpoints, events: WEBHOOK_EVENTS });
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org webhooks POST", async () => {
    const { id } = await params;
    const { caller } = await requireOrgAccess(id, "org.integrations");
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const r = await createEndpoint(id, parsed.data, { id: caller.userId, name: caller.name });
    if (!r.ok) {
      const map: Record<string, [string, number]> = {
        "no-contract": ["مفيش اتفاق ساري مع المنصة يسمح بالـ webhooks", 403],
        limit: ["وصلت للحد الأقصى من العناوين في الاتفاق", 409],
        "bad-url": ["العنوان لازم يكون https عام (مش عنوان داخلي)", 422],
        "bad-events": ["اختار أحداث صحيحة", 422],
        "no-key": ["مفتاح التشفير مش متظبط على السيرفر", 503],
      };
      const [m, s] = map[r.why] ?? ["مينفعش", 409];
      return err(m, s, { code: r.why, detail: r.detail });
    }
    return ok({ id: r.id, secret: r.secret }, 201);
  });
}
