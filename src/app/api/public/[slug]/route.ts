import { err } from "@/lib/api";
import { log } from "@/lib/logger";
import { getPublicProfile } from "@/lib/discovery/profile";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/[slug]
 *
 * One published business as the public may see it — the app's business
 * screen. Fields are listed one by one in getPublicProfile(); this used
 * to return the whole row minus ownerId, plan and payment ids included.
 *
 * Cached briefly at the edge: the next free time moves as people book,
 * and an unpublished business should stop being served within a minute
 * or two.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const profile = await getPublicProfile(slug);
    if (!profile) return err("لم يتم العثور على هذا العمل", 404);
    return Response.json(profile, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    log.error("[public slug]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
