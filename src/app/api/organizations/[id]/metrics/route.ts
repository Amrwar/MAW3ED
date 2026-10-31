import { ok } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { organizationMetrics } from "@/lib/organizations/public";
import { orgHandle } from "@/lib/organizations/route";

/**
 * GET /api/organizations/:id/metrics — visits to the organization's
 * page by channel, and bookings that started there, as counts per
 * business. Never a customer, a price or a booking's contents.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org metrics GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.metrics");
    const days = Number(new URL(req.url).searchParams.get("days"));
    return ok(await organizationMetrics(id, [7, 30, 90].includes(days) ? days : 30));
  });
}
