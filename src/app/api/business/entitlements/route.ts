import { ok, err, requireBusiness } from "@/lib/api";
import { loadEntitlements } from "@/lib/business/entitlements";
import { log } from "@/lib/logger";

/**
 * GET /api/business/entitlements
 *
 * The signed-in owner's plan, what it allows, and how much is used —
 * from the same matrix the server enforces (lib/plans.ts). Clients show
 * this; they never decide a limit for themselves.
 */
export async function GET() {
  try {
    const { business } = await requireBusiness();
    const view = await loadEntitlements(business.id);
    if (!view) return err("لم يتم العثور على عملك", 404);
    return ok(view);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business entitlements]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
