import { z } from "zod";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { cairoDay } from "@/lib/attribution/day";

type Params = { params: Promise<{ slug: string }> };

const schema = z.object({
  source: z.enum([
    "DIRECT", "INSTAGRAM", "WHATSAPP", "FACEBOOK",
    "GOOGLE", "WEBSITE", "QR", "MAW3ED", "OTHER",
  ]),
});

/**
 * POST /api/public/[slug]/view
 *
 * Counts one visit to a business page.
 *
 * Writes a single integer. There is no row here that could identify a
 * visitor — no IP, no cookie, no user agent, no session — so there is
 * also nothing to leak, nothing to ask consent for, and nothing to
 * delete when somebody asks.
 *
 * The counts are shown to the business and to nobody else, and they
 * feed no ranking, so a business that chose to inflate its own numbers
 * would be fooling only itself. That is why this is not rate limited by
 * anything that would require storing who called it.
 *
 * It answers 204 whatever happens. A page must never break, or look
 * broken, because a counter failed.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(null, { status: 204 });

    const business = await db.business.findUnique({
      where: { slug, isPublished: true },
      select: { id: true },
    });
    if (!business) return new Response(null, { status: 204 });

    // Upsert on (business, source, day). The unique index is what makes
    // this safe under load: two visitors landing in the same second
    // both increment rather than one overwriting the other's read.
    await db.profileView.upsert({
      where: {
        businessId_source_day: {
          businessId: business.id,
          source: parsed.data.source,
          day: cairoDay(),
        },
      },
      create: {
        businessId: business.id,
        source: parsed.data.source,
        day: cairoDay(),
        count: 1,
      },
      update: { count: { increment: 1 } },
    });

    return new Response(null, { status: 204 });
  } catch (e) {
    log.error("[profile view]", e);
    return new Response(null, { status: 204 });
  }
}
