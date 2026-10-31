import { ok, err, requireBusiness } from "@/lib/api";
import { respondAsBusiness } from "@/lib/organizations/associations";
import { orgHandle, readJson } from "@/lib/organizations/route";
import { businessResponseSchema } from "@/lib/organizations/rules";


/**
 * PATCH /api/business/organizations/:id — the owner answers an
 * invitation (granting scopes), leaves, pauses or resumes, or changes
 * what the organization may operate. Only this business's own
 * associations, and only its owner: delegated access never grants the
 * power to change delegations.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("business organization PATCH", async () => {
    const { session, business } = await requireBusiness();
    const { id } = await params;
    const parsed = businessResponseSchema.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "بيانات غير صالحة", 422);
    await respondAsBusiness({
      businessId: business.id,
      userId: session.user.id,
      associationId: id,
      action: parsed.data.action,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ?? null,
    });
    return ok({ saved: true });
  });
}
