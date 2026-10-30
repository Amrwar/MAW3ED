import { z } from "zod";
import { ok, err, requireBusiness } from "@/lib/api";
import { respondAsBusiness } from "@/lib/organizations/associations";
import { orgHandle, readJson } from "@/lib/organizations/route";

const schema = z.object({ action: z.enum(["accept", "decline", "leave"]) });

/**
 * PATCH /api/business/organizations/:id — the owner answers an
 * invitation, or leaves. Only this business's own associations.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("business organization PATCH", async () => {
    const { session, business } = await requireBusiness();
    const { id } = await params;
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) return err("بيانات غير صالحة", 422);
    await respondAsBusiness({ businessId: business.id, userId: session.user.id, associationId: id, action: parsed.data.action });
    return ok({ saved: true });
  });
}
