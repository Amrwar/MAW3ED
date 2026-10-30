import { ok } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { listVenueMemberships } from "@/lib/venues/memberships";
import { handle } from "@/lib/venues/route";

/** GET /api/venues/:id/memberships — requests and tenants of this venue only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue memberships GET", async () => {
    const { id } = await params;
    await requireVenueAccess(id, "venue.view");
    return ok({ memberships: await listVenueMemberships(id) });
  });
}
