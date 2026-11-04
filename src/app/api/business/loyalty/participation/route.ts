import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { businessHandle, readJson } from "@/lib/business/route";

/**
 * The business's answer to an organization's loyalty program: accept or
 * leave. Only the owner decides; an organization can invite, never
 * enrol. While the business runs an active program of its own, its own
 * wins (lib/loyalty/ledger programForBusiness).
 */
const body = z.object({ participationId: z.string().min(1).max(40), action: z.enum(["accept", "leave"]) });

export async function POST(req: Request) {
  return businessHandle("loyalty participation", async () => {
    const { business } = await requireBusiness();
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err("طلب غير صحيح", 422, { code: "invalid" });
    const { participationId, action } = parsed.data;
    const { count } = await db.loyaltyParticipation.updateMany({
      where: { id: participationId, businessId: business.id },
      // Accepting again after leaving rejoins.
      data: action === "accept" ? { acceptedAt: new Date(), leftAt: null } : { leftAt: new Date() },
    });
    if (count !== 1) return err("الدعوة مش موجودة", 404, { code: "not-found" });
    return ok({ ok: true });
  });
}
