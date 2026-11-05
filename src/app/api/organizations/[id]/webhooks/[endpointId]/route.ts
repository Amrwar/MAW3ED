import { z } from "zod";
import { ok, err } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { deleteEndpoint, pingEndpoint, rotateEndpointSecret, setEndpointStatus } from "@/lib/enterprise/webhooks";

/** POST /api/organizations/:id/webhooks/:endpointId {action: rotate|enable|disable|ping|delete}. Owner only. */
const body = z.object({ action: z.enum(["rotate", "enable", "disable", "ping", "delete"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string; endpointId: string }> }) {
  return orgHandle("org webhook action", async () => {
    const { id, endpointId } = await params;
    const { caller } = await requireOrgAccess(id, "org.integrations");
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    const actor = { id: caller.userId, name: caller.name };
    switch (parsed.data.action) {
      case "rotate": {
        const r = await rotateEndpointSecret(id, endpointId, actor);
        return r.ok ? ok({ secret: r.secret }) : err("العنوان غير موجود", 404, { code: r.why });
      }
      case "enable":
      case "disable":
        return (await setEndpointStatus(id, endpointId, parsed.data.action === "enable", actor))
          ? ok({ ok: true })
          : err("العنوان غير موجود", 404, { code: "not-found" });
      case "ping": {
        const r = await pingEndpoint(id, endpointId);
        return r ? ok(r) : err("العنوان غير موجود", 404, { code: "not-found" });
      }
      case "delete":
        return (await deleteEndpoint(id, endpointId, actor)) ? ok({ ok: true }) : err("العنوان غير موجود", 404, { code: "not-found" });
    }
  });
}
