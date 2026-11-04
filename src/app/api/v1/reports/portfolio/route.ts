import { apiHandle, requireApiClient } from "@/lib/enterprise/auth";
import { organizationPortfolio } from "@/lib/organizations/portfolio";

/**
 * GET /api/v1/reports/portfolio?days=7|30|90 — the same portfolio the
 * organization console shows: per business, counts where the business
 * shares REPORTS, money only where it also shares FINANCE.
 */
export async function GET(req: Request) {
  return apiHandle(async () => {
    const c = await requireApiClient(req, "reports:read");
    const days = Number(new URL(req.url).searchParams.get("days"));
    return Response.json({ data: await organizationPortfolio(c.organizationId, [7, 30, 90].includes(days) ? days : 30) });
  });
}
