import { ok } from "@/lib/api";
import { requireOrgAccess } from "@/lib/organizations/guard";
import { orgHandle } from "@/lib/organizations/route";
import { integrationHealth } from "@/lib/enterprise/health";

/**
 * GET /api/organizations/:id/integrations — contract, API usage, webhook
 * and visitor-access health, and the plans of owned brands that share
 * FINANCE. Owners and managers (org.view); states and counts only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return orgHandle("org integrations GET", async () => {
    const { id } = await params;
    await requireOrgAccess(id, "org.view");
    return ok(await integrationHealth(id));
  });
}
