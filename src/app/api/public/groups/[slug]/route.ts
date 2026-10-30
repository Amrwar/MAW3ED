import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { loadPublicOrganization } from "@/lib/organizations/public";

/**
 * GET /api/public/groups/:slug — a published organization and its
 * approved directory, for the app. Pending, suspended or unknown is 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const organization = await loadPublicOrganization(slug);
    if (!organization) return err("غير موجود", 404);
    return ok({ organization });
  } catch (e) {
    log.error("[public group]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
