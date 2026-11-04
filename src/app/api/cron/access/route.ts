import { authorizeCron } from "@/lib/security/cron-auth";
import { withCronRun } from "@/lib/ops/cron-run";
import { log } from "@/lib/logger";
import { reconcileAccess } from "@/lib/access/reconcile";

/**
 * GET /api/cron/access
 *
 * Every five minutes (vercel.json): visitor passes are decided again
 * where something may have changed, ended windows expire, provider calls
 * that are due run, passes a provider never confirmed are chased, and
 * providers are health-checked (lib/access/reconcile.ts). Every step is
 * a bounded batch inside a time budget; what is left waits for the next
 * run. Nothing here loops.
 *
 * Security: Vercel attaches Authorization: Bearer <CRON_SECRET>; with no
 * secret set the job refuses to run (lib/security/cron-auth).
 */
export const maxDuration = 60;

async function handle(req: Request): Promise<Response> {
  const allowed = authorizeCron(req, "access");
  if (!allowed.ok) return allowed.response;
  const now = new Date();
  try {
    // Checked before each item; the slowest item (a status call and a
    // replay, 2 × 8 s) and the health checks must still end inside
    // maxDuration, or the platform kills the run mid-call.
    const result = await reconcileAccess({ now, budgetMs: 30_000 });
    return Response.json({ ok: true, at: now.toISOString(), ...result });
  } catch (e) {
    log.error("[access cron] failed", e);
    return Response.json({ ok: false, at: now.toISOString() }, { status: 500 });
  }
}

/** Recorded in CronRun (lib/ops/cron-run) — when it ran, whether it worked. */
export async function GET(req: Request) {
  return withCronRun("access", () => handle(req));
}
