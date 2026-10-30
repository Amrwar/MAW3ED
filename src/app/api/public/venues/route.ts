import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { listPublicVenues } from "@/lib/venues/public";

/** GET /api/public/venues — published venues, for the app. Public read. */
export async function GET() {
  try {
    return ok({ venues: await listPublicVenues() });
  } catch (e) {
    log.error("[public venues]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
