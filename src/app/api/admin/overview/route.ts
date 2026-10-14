import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { adminOverview } from "@/lib/admin/overview";

/**
 * GET /api/admin/overview
 *
 * The admin landing figures, for the app's admin space. Any admin role
 * may ask; each figure is null where the role may not see it. Not an
 * admin: 404, as for every admin route, so the API does not announce
 * that it exists.
 */
export async function GET() {
  try {
    const actor = await requireAdminApi("reviews.read");
    if (!actor) return adminNotFound();
    return ok({ role: actor.role, ...(await adminOverview(actor.role)) });
  } catch (e) {
    log.error("[admin overview]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
