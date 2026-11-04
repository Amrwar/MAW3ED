import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Every scheduled job's runs, in CronRun: when it started and finished,
 * whether it succeeded, and what it reported. /api/health and the admin
 * operations page read them to say when a job last succeeded, so a job
 * that silently stopped is noticed (docs/enterprise/OPERATIONS_RUNBOOK.md).
 *
 * A request that was refused (no or wrong secret) is not a run and is not
 * recorded. Runs older than 30 days are pruned, a bounded batch at a time.
 */
export async function withCronRun(job: string, run: () => Promise<Response>): Promise<Response> {
  // Recording a run must never stop the job itself: any failure here
  // (the table missing, the database slow) is logged and the job runs.
  let started: { id: string } | null = null;
  try {
    started = await db.cronRun.create({ data: { job }, select: { id: true } });
  } catch (e) {
    log.error("[cron-run] could not record a start", e, { job });
  }
  let res: Response;
  try {
    res = await run();
  } catch (e) {
    if (started) {
      await Promise.resolve()
        .then(() => db.cronRun.update({ where: { id: started!.id }, data: { finishedAt: new Date(), ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 500) } }))
        .catch(() => {});
    }
    throw e;
  }
  if (started) {
    if (res.status === 401 || res.status === 503) {
      await db.cronRun.delete({ where: { id: started.id } }).catch(() => {});
      return res;
    }
    let summary: unknown = null;
    try {
      summary = await res.clone().json();
    } catch {
      summary = null;
    }
    const text = JSON.stringify(summary ?? null);
    await db.cronRun
      .update({
        where: { id: started.id },
        data: {
          finishedAt: new Date(),
          ok: res.ok && (summary as { ok?: boolean } | null)?.ok !== false,
          summary: text.length <= 4000 ? (summary as object) ?? undefined : { truncated: true },
        },
      })
      .catch((e) => log.error("[cron-run] could not record a finish", e, { job }));
  }
  return res;
}

/** Drops runs older than 30 days, at most 1,000 per call. */
export async function pruneCronRuns(now: Date = new Date()): Promise<number> {
  return db.$executeRaw`
    DELETE FROM "CronRun" WHERE "id" IN (
      SELECT "id" FROM "CronRun" WHERE "startedAt" < ${new Date(now.getTime() - 30 * 86_400_000)} LIMIT 1000)`;
}

/** The latest finished run of each job, for health and the operations page. */
export async function lastRuns(jobs: readonly string[]) {
  const out: Record<string, { lastStartedAt: string | null; lastOkAt: string | null; lastOk: boolean | null }> = {};
  for (const job of jobs) {
    const [last, lastOk] = await Promise.all([
      db.cronRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" }, select: { startedAt: true, ok: true } }),
      db.cronRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
    ]);
    out[job] = { lastStartedAt: last?.startedAt.toISOString() ?? null, lastOkAt: lastOk?.startedAt.toISOString() ?? null, lastOk: last?.ok ?? null };
  }
  return out;
}

/** Each job and how long it may go without a successful run before it is late. */
export const JOB_SLA_MINUTES: Record<string, number> = {
  reminders: 90,
  notifications: 30,
  subscriptions: 26 * 60,
  operations: 30,
  access: 20,
  integrations: 20,
};
