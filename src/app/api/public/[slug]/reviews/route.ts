import { db } from "@/lib/db";
import { err } from "@/lib/api";
import {
  getBusinessReviews,
  parseRatingFilter,
  parseReviewSort,
} from "@/lib/reviews";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ slug: string }> };

/** Caps what one request can pull back, however the URL is written. */
const PAGE_SIZE = 10;

/**
 * GET /api/public/[slug]/reviews?sort=&rating=&page=
 *
 * Sorting and filtering for the reviews block, so changing either does
 * not reload the profile. Reads the same helpers the server page uses,
 * so the first render and every later one agree.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);

    const business = await db.business.findUnique({
      where: { slug, isPublished: true },
      select: { id: true },
    });
    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    const pageRaw = Number(searchParams.get("page"));
    const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 100) : 1;

    const { reviews, matched } = await getBusinessReviews(business.id, {
      sort: parseReviewSort(searchParams.get("sort") ?? undefined),
      rating: parseRatingFilter(searchParams.get("rating") ?? undefined),
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    });

    // The same for everyone, so a CDN may answer it; short, so a new
    // review shows within a minute.
    return Response.json(
      { reviews, matched, page, pageSize: PAGE_SIZE },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch (e) {
    log.error("[public reviews]", e);
    return err("حدث خطأ", 500);
  }
}
