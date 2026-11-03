import { ok } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { organizationPortfolio } from "@/lib/organizations/portfolio";
import { orgHandle } from "@/lib/organizations/route";

/**
 * GET /api/organizations/:id/portfolio — bookings and, where granted,
 * revenue across the businesses the organization owns or manages, per
 * business and in total. Each business decides what it shares (REPORTS,
 * FINANCE); counts and sums only.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org portfolio GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.metrics");
    const days = Number(new URL(req.url).searchParams.get("days"));
    return ok(await organizationPortfolio(id, [7, 30, 90].includes(days) ? days : 30));
  });
}
