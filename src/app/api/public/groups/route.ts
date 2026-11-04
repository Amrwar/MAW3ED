import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { listPublicOrganizations } from "@/lib/organizations/public";

/**
 * GET /api/public/groups — published organizations, for the app. Public read.
 *
 * Optional ?q= (a name; folded like the website's search) and
 * ?type=destinations|groups. Without them, every published organization,
 * as before.
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const type = sp.get("type");
    const family = type === "destinations" || type === "groups" ? type : undefined;
    return ok({ organizations: await listPublicOrganizations({ q: q || undefined, family }) });
  } catch (e) {
    log.error("[public groups]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
