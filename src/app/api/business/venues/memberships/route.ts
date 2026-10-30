import { z } from "zod";
import { ok, err, requireBusiness } from "@/lib/api";
import { requestMembership } from "@/lib/venues/memberships";
import { handle, readJson } from "@/lib/venues/route";

const schema = z.object({
  venueId: z.string().min(1),
  branchId: z.string().min(1).nullable().optional(),
  unit: z.string().trim().max(40).nullable().optional(),
});

/**
 * POST /api/business/venues/memberships — the owner asks for their
 * business, or one of its branches, to be listed in a venue. The venue
 * decides; until then nothing is public. Owner only.
 */
export async function POST(req: Request) {
  return handle("business venue membership POST", async () => {
    const { session, business } = await requireBusiness();
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    const m = await requestMembership({
      businessId: business.id,
      userId: session.user.id,
      venueId: parsed.data.venueId,
      branchId: parsed.data.branchId ?? null,
      unit: parsed.data.unit?.trim() || null,
    });
    return ok({ membership: m }, 201);
  });
}
