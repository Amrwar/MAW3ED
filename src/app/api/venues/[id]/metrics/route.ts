import { ok } from "@/lib/api";
import { requireVenueAccess } from "@/lib/venues/guard";
import { venueMetrics } from "@/lib/venues/metrics";
import { handle } from "@/lib/venues/route";

/** GET /api/venues/:id/metrics — counts only; see lib/venues/metrics.ts. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle("venue metrics GET", async () => {
    const { id } = await params;
    await requireVenueAccess(id, "venue.metrics");
    const days = Number(new URL(req.url).searchParams.get("days"));
    return ok(await venueMetrics(id, [7, 30, 90].includes(days) ? days : 30));
  });
}
