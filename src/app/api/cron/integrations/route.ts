import { authorizeCron } from "@/lib/security/cron-auth";
import { collectEvents, processDeliveries } from "@/lib/enterprise/webhooks";
import { pruneCronRuns, withCronRun } from "@/lib/ops/cron-run";
import { log } from "@/lib/logger";

export const maxDuration = 60;

/**
 * GET /api/cron/integrations — every 5 minutes (vercel.json): read the
 * change feed into webhook deliveries, send what is due (bounded: 50
 * deliveries and 25 s per run), and prune old job runs. Safe to run twice.
 */
async function handle(req: Request): Promise<Response> {
  const allowed = authorizeCron(req, "integrations");
  if (!allowed.ok) return allowed.response;
  const now = new Date();
  try {
    const feed = await collectEvents(now);
    const sent = await processDeliveries(now, 50, 25_000);
    const pruned = await pruneCronRuns(now);
    return Response.json({ ok: true, at: now.toISOString(), feed, sent, pruned });
  } catch (e) {
    log.error("[integrations cron] failed", e);
    return Response.json({ ok: false, at: now.toISOString() }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return withCronRun("integrations", () => handle(req));
}
