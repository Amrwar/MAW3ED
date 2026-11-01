import { log } from "@/lib/logger";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { ingestProviderEvent } from "@/lib/access/events";

type Params = { params: Promise<{ slug: string }> };

/** Callbacks are small; anything larger is not one. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * POST /api/access/providers/:slug/events — an access provider's signed
 * callback (a credential confirmed or refused, someone let in or turned
 * away). The provider's adapter checks the signature and freshness; the
 * event is applied idempotently and recorded once (lib/access/events.ts).
 *
 *   200 accepted / duplicate (a retried delivery: already have it)
 *   409 an event for a credential Maw3ed does not know (yet): not
 *       recorded, so the provider retries — a confirmation can race the
 *       answer that tells Maw3ed the provider's reference
 *   401 signature, timestamp or shape refused
 *   404 no such provider; 409 provider not usable here
 */
export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  try {
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return Response.json({ ok: false }, { status: 404 });
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "too large" }, { status: 413 });
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "too large" }, { status: 413 });

    const outcome = await ingestProviderEvent(slug, raw, req.headers);
    if (outcome === "invalid" || outcome === "unknown-provider") {
      // Signed callbacks are never throttled (a gate system reports every
      // entry); requests failing the check are, per address.
      const limited = await rateLimit("accessWebhookInvalid");
      if (!limited.ok) return tooManyRequests(limited);
    }
    const status =
      outcome === "accepted" || outcome === "duplicate" ? 200
      : outcome === "unknown-credential" ? 409
      : outcome === "invalid" ? 401
      : outcome === "unknown-provider" ? 404
      : 409;
    return Response.json({ ok: status < 300, outcome }, { status });
  } catch (e) {
    log.error("[access provider event]", e, { slug });
    // 500 so the provider retries: the event was not recorded.
    return Response.json({ ok: false }, { status: 500 });
  }
}
