import { z } from "zod";
import { ok, err } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { handle, readJson, venueAudit } from "@/lib/venues/route";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { securityReinstate, securitySuspend } from "@/lib/access/passes";

type Ctx = { params: Promise<{ id: string; entitlementId: string }> };

const schema = z.object({
  action: z.enum(["suspend", "reinstate"]),
  note: z.string().trim().min(3, "اكتب السبب").max(300),
});

/**
 * POST /api/venues/:id/access/entitlements/:entitlementId
 *   { action: "suspend" | "reinstate", note }
 *
 * The security desk holds a visitor's pass (the provider is told to
 * withdraw it) or restores it (Maw3ed decides the right again from
 * scratch — a booking cancelled meanwhile stays off — and asks for a new
 * pass). Always with a reason, recorded with who did it. Needs
 * venue.access.override; a business has no venue authority, so it can
 * never undo the desk's decision.
 */
export async function POST(req: Request, { params }: Ctx) {
  return handle("venue access override", async () => {
    const { id, entitlementId } = await params;
    const { caller, authority } = await requireVenueAccess(id, "venue.access.override");
    const limited = await rateLimit("accessOverride", `user:${caller.userId}`);
    if (!limited.ok) return tooManyRequests(limited);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    const { action, note } = parsed.data;
    const done =
      action === "suspend"
        ? await securitySuspend(entitlementId, id, caller.userId, note)
        : await securityReinstate(entitlementId, id, caller.userId, note);
    if (!done) return err("التصريح ده مش في حالة تسمح بالإجراء ده", 409, { code: "not-applicable" });
    await venueAudit(caller, authority, `venue.access.${action}`, id, action === "suspend" ? "وقّف تصريح زائر" : "رجّع تصريح زائر", {
      entitlementId,
      note,
    });
    return ok({ done: true });
  });
}
