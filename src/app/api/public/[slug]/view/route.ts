import { z } from "zod";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { cairoDay } from "@/lib/attribution/day";
import { callerKey, rateLimit } from "@/lib/rate-limit";

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
 * would be fooling only itself. It is rate limited per listing and per
 * address all the same (a script must not inflate a rival's figures or
 * fill the table), through the keyed-hash counters in lib/rate-limit:
 * nothing stored says who called.
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

    // A counter the owner reads as demand; a script must not be able to
    // run it up. Per listing and per address — not per address alone,
    // which on a carrier NAT shared by thousands of phones would stop
    // counting every listing after the first few dozen opens. Only after
    // the body and slug are known, so junk costs no write. Over the
    // limit the request is simply not counted. The bucket key is a keyed
    // hash (lib/rate-limit.ts); no address is stored.
    const limited = await rateLimit("profileView", `${business.id}|${await callerKey()}`);
    if (!limited.ok) return new Response(null, { status: 204 });

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
