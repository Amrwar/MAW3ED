import { parseDiscoveryQuery } from "@/lib/discovery/params";
import { searchBusinesses } from "@/lib/discovery/search";
import { err } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * GET /api/public/businesses?<the same parameters as /businesses>
 *
 * One page of results. This is what "load more" on a phone appends; it
 * reads the identical contract as the page, so the two can never
 * disagree about what a filter means.
 *
 * Public and read-only. It returns a page, never the catalogue — the
 * page size and the page ceiling are enforced in parseDiscoveryQuery.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = parseDiscoveryQuery(Object.fromEntries(searchParams.entries()));

    // No price bounds: nothing reading this route shows a price slider,
    // and they cost an aggregate over the whole catalogue.
    const result = await searchBusinesses(query, new Date(), { priceBounds: false });

    return Response.json(
      {
        businesses: result.businesses,
        total: result.total,
        page: result.page,
        pageCount: result.pageCount,
        capped: result.capped,
      },
      // The same answer for everyone, so the CDN can serve repeats. Kept
      // short: each card's next free time moves as people book, and an
      // unpublished business must drop out of results promptly.
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    log.error("[public businesses]", e);
    return err("حدث خطأ أثناء البحث", 500);
  }
}
