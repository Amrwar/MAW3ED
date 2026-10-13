import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { getFacets } from "@/lib/discovery/search";

/**
 * GET /api/public/facets?city=<slug>
 *
 * The categories and cities the website's filter panel offers, with how
 * many published businesses each holds — the same getFacets() the
 * /businesses page calls server-side. The app's home and search read it
 * so a category with nothing in it is never offered as if it had.
 */
export async function GET(req: Request) {
  try {
    const city = new URL(req.url).searchParams.get("city")?.trim() || undefined;
    const facets = await getFacets(city);
    return ok(facets);
  } catch (e) {
    log.error("[public facets]", e);
    return err("حدث خطأ", 500);
  }
}
