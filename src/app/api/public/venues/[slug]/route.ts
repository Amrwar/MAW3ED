import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { loadPublicVenue } from "@/lib/venues/public";

/**
 * GET /api/public/venues/:slug — a published venue and its approved
 * directory, for the app. A draft, suspended or unknown venue is 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const venue = await loadPublicVenue(slug);
    if (!venue) return err("غير موجود", 404);
    return ok({ venue });
  } catch (e) {
    log.error("[public venue]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
