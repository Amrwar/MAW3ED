import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { escalate } from "@/lib/access/passes";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  note: z.string().trim().min(3, "اكتب اللي حصل").max(300),
  entitlementId: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/venues/:id/access/escalations { note, entitlementId? }
 *
 * The desk records something a person must follow up — a visitor turned
 * away who should not have been, a gate disagreeing with Maw3ed. Shown on
 * the desk's "needs attention" list with the provider's own failures.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle("venue access escalation", async () => {
    const { id } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.access.override");
    const limited = await rateLimit("accessOverride", `user:${caller.userId}`);
    if (!limited.ok) return tooManyRequests(limited);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    if (parsed.data.entitlementId) {
      const own = await db.accessEntitlement.count({ where: { id: parsed.data.entitlementId, venueId: id } });
      if (!own) return err("غير موجود", 404);
    }
    await escalate(parsed.data.entitlementId ?? null, id, caller.userId, parsed.data.note);
    await venueAudit(caller, authority, "venue.access.escalate", id, "سجّل تصعيد لدخول الزوار", { entitlementId: parsed.data.entitlementId ?? null });
    return ok({ escalated: true }, 201);
  });
}
