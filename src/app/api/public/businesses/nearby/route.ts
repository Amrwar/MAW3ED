import { parseDiscoveryQuery } from "@/lib/discovery/params";
import { findNearby } from "@/lib/discovery/nearby";
import { validLatLng } from "@/lib/geo";
import { err } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * GET /api/public/businesses/nearby?lat=&lng=&radius=&limit=&category=&q=
 *
 * Businesses near a point, nearest first, each with its distance — the
 * app's "near me" and map. The filters are the search's own (category,
 * text, rating, availability), so "clinics near me" means what
 * "clinics" means everywhere else.
 *
 * Where somebody is, is theirs: the coordinates are used for this query
 * and nothing else — not logged, not stored, and the answer is not
 * cached anywhere it could be read back.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!searchParams.get("lat") || !searchParams.get("lng") || !validLatLng(lat, lng)) {
      return err("الموقع غير صالح", 400, { code: "invalid-location" });
    }

    const radius = Number(searchParams.get("radius")) || undefined;
    const limit = Number(searchParams.get("limit")) || undefined;
    const query = parseDiscoveryQuery(Object.fromEntries(searchParams.entries()));

    const result = await findNearby({ lat, lng }, { radiusKm: radius, limit, query });

    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    // The error only: the request's URL holds the person's location.
    log.error("[public nearby]", e instanceof Error ? { message: e.message } : undefined);
    return err("حدث خطأ أثناء البحث", 500);
  }
}
