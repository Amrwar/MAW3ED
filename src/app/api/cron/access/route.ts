import { authorizeCron } from "@/lib/security/cron-auth";
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

export async function GET(req: Request) {
  const allowed = authorizeCron(req, "access");
  if (!allowed.ok) return allowed.response;
  const now = new Date();
  try {
    const result = await reconcileAccess({ now, budgetMs: 45_000 });
    return Response.json({ ok: true, at: now.toISOString(), ...result });
  } catch (e) {
    log.error("[access cron] failed", e);
    return Response.json({ ok: false, at: now.toISOString() }, { status: 500 });
  }
}
