import { ok } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";
import { organizationPackageReport } from "@/lib/organizations/loyalty";

/**
 * GET /api/organizations/:id/packages — packages and memberships across
 * the owned brands that share reports (REPORTS scope). Counts only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org packages GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.metrics");
    return ok(await organizationPackageReport(id));
  });
}
