import { ok, err } from "@/lib/api";
import { loadVenueCaller } from "@/lib/venues/guard";
import { operableBusinesses } from "@/lib/organizations/delegation";
import { orgHandle } from "@/lib/organizations/route";

/**
 * GET /api/organizations/operable — the businesses the caller may operate
 * through their organizations right now: granted, unexpired, approved
 * relationships of organizations the platform approved, where the caller
 * is an owner or manager. What the "Manage" buttons are built from.
 */
export async function GET() {
  return orgHandle("operable GET", async () => {
    const caller = await loadVenueCaller();
    if (!caller) return err("سجّل دخولك الأول", 401);
    const rows = await operableBusinesses(caller.userId);
    return ok({
      businesses: rows.map((r) => ({ ...r, expiresAt: r.expiresAt?.toISOString() ?? null })),
    });
  });
}
