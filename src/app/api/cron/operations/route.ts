import { authorizeCron } from "@/lib/security/cron-auth";
import { withCronRun } from "@/lib/ops/cron-run";
import { runOperations } from "@/lib/automations/run";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/operations
 *
 * Every ten minutes (vercel.json): the slot waitlist (lapsed offers pass
 * on, freed times are offered), loyalty points and packages/memberships
 * that ran out, and the Phase 27 customer messages (lib/automations/run).
 * Bounded and idempotent; safe to run twice.
 *
 * Security: Vercel attaches Authorization: Bearer <CRON_SECRET>; with no
 * secret set the job refuses to run (lib/security/cron-auth).
 */
async function handle(req: Request): Promise<Response> {
  const allowed = authorizeCron(req, "operations");
  if (!allowed.ok) return allowed.response;
  const now = new Date();
  try {
    const result = await runOperations(now);
    return Response.json({ ok: result.failed.length === 0, at: now.toISOString(), ...result });
  } catch (e) {
    log.error("[operations cron] failed", e);
    return Response.json({ ok: false, at: now.toISOString() }, { status: 500 });
  }
}

/** Recorded in CronRun (lib/ops/cron-run) — when it ran, whether it worked. */
export async function GET(req: Request) {
  return withCronRun("operations", req, () => handle(req));
}
