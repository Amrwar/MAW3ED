import { ok, err } from "@/lib/api";
import { loadVenueCaller, venuesFor } from "@/lib/venues/guard";
import { handle } from "@/lib/venues/route";

/**
 * GET /api/venues — the venues the signed-in person may manage: all of
 * them for a platform administrator, otherwise those their venue roles
 * reach. Empty for everybody else.
 */
export async function GET() {
  return handle("venues GET", async () => {
    const caller = await loadVenueCaller();
    if (!caller) return err("سجّل دخولك الأول", 401);
    return ok({ venues: await venuesFor(caller) });
  });
}
