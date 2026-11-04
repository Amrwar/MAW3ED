import { z } from "zod";
import { log } from "@/lib/logger";
import { callerKey, rateLimit } from "@/lib/rate-limit";
import { recordFunnelStep } from "@/lib/analytics/funnel";
import { FUNNEL_STEPS } from "@/lib/analytics/funnel-steps";

const SOURCES = ["DIRECT", "INSTAGRAM", "WHATSAPP", "FACEBOOK", "GOOGLE", "WEBSITE", "QR", "MAW3ED", "OTHER"] as const;

const schema = z.object({
  step: z.enum(FUNNEL_STEPS),
  tab: z.string().max(64),
  source: z.enum(SOURCES),
  business: z.string().max(120).nullish(),
  org: z.string().max(120).nullish(),
});

/**
 * POST /api/public/funnel — one funnel step reached by one browser tab.
 *
 * Counted once per tab, step, business, organization and day; nothing
 * identifying is stored (lib/analytics/funnel.ts). Answers 204 whatever
 * happens: a page must never break, or look broken, because a counter
 * did. Rate limited per address through keyed-hash buckets.
 */
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return new Response(null, { status: 204 });
    const { step, business, org } = parsed.data;
    const limited = await rateLimit("funnel", `${step}|${business ?? ""}|${org ?? ""}|${await callerKey()}`);
    if (!limited.ok) return new Response(null, { status: 204 });
    const outcome = await recordFunnelStep(parsed.data);
    // The outcome is for the QA checks; it says nothing a visitor could use.
    return new Response(null, { status: 204, headers: { "x-funnel": outcome } });
  } catch (e) {
    log.error("[funnel]", e);
    return new Response(null, { status: 204 });
  }
}
