import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { log } from "@/lib/logger";
import { healthReport } from "@/lib/ops/health";
import { JOB_SLA_MINUTES } from "@/lib/ops/cron-run";
import { FLAGS, flagOn } from "@/lib/flags";

/**
 * GET /api/admin/operations — the operations dashboard: health (database,
 * job freshness, queue depths), the latest runs of every scheduled job and
 * which feature flags are on. Counts and states only. reports.read.
 */
export async function GET() {
  try {
    const admin = await requireAdminApi("reports.read");
    if (!admin) return adminNotFound();
    const [health, runs] = await Promise.all([
      healthReport(),
      db.cronRun.findMany({ orderBy: { startedAt: "desc" }, take: 60, select: { id: true, job: true, startedAt: true, finishedAt: true, ok: true, error: true } }),
    ]);
    return ok({ health, runs, slaMinutes: JOB_SLA_MINUTES, flags: FLAGS.map((f) => ({ flag: f, on: flagOn(f) })) });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[admin operations]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
