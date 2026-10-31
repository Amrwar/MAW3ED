import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { listPublicOrganizations } from "@/lib/organizations/public";

/** GET /api/public/groups — published organizations, for the app. Public read. */
export async function GET() {
  try {
    return ok({ organizations: await listPublicOrganizations() });
  } catch (e) {
    log.error("[public groups]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
