import { ok, err, requireBusiness } from "@/lib/api";
import { loadReadiness } from "@/lib/business/readiness-load";
import { getVerificationStates } from "@/lib/business-verification";
import { log } from "@/lib/logger";

/**
 * GET /api/business/readiness
 *
 * The setup checklist for the signed-in owner's business, computed on
 * the server (lib/business/readiness.ts), plus the four verification
 * states kept apart. The setup page, the dashboard's progress card and
 * the app read this; none of them works the answer out for itself.
 */
export async function GET() {
  try {
    const { business } = await requireBusiness();
    const [readiness, verification] = await Promise.all([
      loadReadiness(business.id),
      getVerificationStates(business.id),
    ]);
    if (!readiness || !verification) return err("لم يتم العثور على عملك", 404);
    return ok({
      readiness,
      verification,
      isPublished: business.isPublished,
      publishRequested: business.publishRequestedAt !== null,
      status: business.status,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business readiness]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
