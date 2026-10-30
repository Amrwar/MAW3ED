import { ok, requireBusiness } from "@/lib/api";
import { withdrawMembership } from "@/lib/venues/memberships";
import { handle } from "@/lib/venues/route";

/**
 * DELETE /api/business/venues/memberships/:id — withdraw a request, or
 * leave a venue. Only for this business's own memberships.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("business venue membership DELETE", async () => {
    const { session, business } = await requireBusiness();
    const { id } = await params;
    await withdrawMembership({ businessId: business.id, membershipId: id, userId: session.user.id });
    return ok({ withdrawn: true });
  });
}
