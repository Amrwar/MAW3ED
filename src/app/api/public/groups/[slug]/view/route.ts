import { z } from "zod";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { cairoDay } from "@/lib/attribution/day";
import { callerKey, rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  source: z.enum(["DIRECT", "INSTAGRAM", "WHATSAPP", "FACEBOOK", "GOOGLE", "WEBSITE", "QR", "MAW3ED", "OTHER"]),
});

/**
 * POST /api/public/groups/:slug/view — counts one visit to an
 * organization page, exactly as business pages are counted: one
 * integer per organization, channel and day; nothing identifies the
 * visitor; rate-limited per organization and address through keyed
 * hashes; 204 whatever happens.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(null, { status: 204 });

    const org = await db.organization.findFirst({
      where: { slug, status: "APPROVED", isPublished: true },
      select: { id: true },
    });
    if (!org) return new Response(null, { status: 204 });

    const limited = await rateLimit("orgView", `${org.id}|${await callerKey()}`);
    if (!limited.ok) return new Response(null, { status: 204 });

    const day = cairoDay();
    await db.organizationView.upsert({
      where: { organizationId_source_day: { organizationId: org.id, source: parsed.data.source, day } },
      create: { organizationId: org.id, source: parsed.data.source, day, count: 1 },
      update: { count: { increment: 1 } },
    });
    return new Response(null, { status: 204 });
  } catch (e) {
    log.error("[org view]", e);
    return new Response(null, { status: 204 });
  }
}
