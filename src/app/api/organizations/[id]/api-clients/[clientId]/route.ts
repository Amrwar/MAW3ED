import { z } from "zod";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { revokeApiClient, rotateApiClient } from "@/lib/enterprise/clients";

/** POST /api/organizations/:id/api-clients/:clientId {action: rotate|revoke}. Owner only. */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rotate"), graceHours: z.number().int().min(0).max(72).optional() }),
  z.object({ action: z.literal("revoke") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string; clientId: string }> }) {
  return orgHandle("org api client action", async () => {
    const { id, clientId } = await params;
    const { caller } = await requireOrgAccess(id, "org.integrations");
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    const actor = { id: caller.userId, name: caller.name };
    if (parsed.data.action === "revoke") {
      const done = await revokeApiClient(id, clientId, actor);
      return done ? ok({ ok: true }) : err("المفتاح غير موجود أو اتلغى قبل كده", 404, { code: "not-found" });
    }
    const r = await rotateApiClient(id, clientId, actor, parsed.data.graceHours ?? 24);
    if (!r.ok) {
      const m: Record<string, string> = {
        "no-contract": "مفيش اتفاق ساري",
        limit: "عدد المفاتيح الشغّالة وصل للحد — استنى المفتاح القديم يخلص أو الغيه",
        revoked: "المفتاح ده اتغيّر أو اتلغى قبل كده — غيّر المفتاح الجديد",
        "not-found": "المفتاح غير موجود",
      };
      return err(m[r.why] ?? "مينفعش", r.why === "not-found" ? 404 : 409, { code: r.why });
    }
    return ok({ id: r.id, prefix: r.prefix, key: r.key }, 201);
  });
}
