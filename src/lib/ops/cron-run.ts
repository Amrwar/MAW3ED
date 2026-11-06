import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { authorizeCron } from "@/lib/security/cron-auth";
import { startCheckIn } from "@/lib/ops/cron-monitor";

/**
 * Every scheduled job's runs, in CronRun: when it started and finished,
 * whether it succeeded, and what it reported. /api/health and the admin
 * operations page read them to say when a job last succeeded, so a job
 * that silently stopped is noticed (docs/enterprise/OPERATIONS_RUNBOOK.md).
 *
 * A request that was refused (no or wrong secret) is not a run and is not
 * recorded. Runs older than 30 days are pruned, a bounded batch at a time.
 */
export async function withCronRun(job: string, req: Request, run: () => Promise<Response>): Promise<Response> {
  // Authorized first: an anonymous or wrongly-keyed request costs no write
  // and is not a run. A missing CRON_SECRET (503) IS recorded, as a failed
  // run — every job silently stopping is exactly what health must show.
  const auth = authorizeCron(req, job);
  if (!auth.ok) {
    if (auth.response.status === 503) {
      await db.cronRun
        .create({ data: { job, finishedAt: new Date(), ok: false, error: "CRON_SECRET is not set: the job cannot run" } })
        .catch(() => {});
    }
    return auth.response;
  }
  // Recording a run must never stop the job itself: any failure here
  // (the table missing, the database slow) is logged and the job runs.
  let started: { id: string } | null = null;
  try {
    started = await db.cronRun.create({ data: { job }, select: { id: true } });
  } catch (e) {
    log.error("[cron-run] could not record a start", e, { job });
  }
  const finishCheckIn = startCheckIn(job);
  let res: Response;
  try {
    res = await run();
  } catch (e) {
    await finishCheckIn(false);
    if (started) {
      await Promise.resolve()
        .then(() => db.cronRun.update({ where: { id: started!.id }, data: { finishedAt: new Date(), ok: false, error: String(e instanceof Error ? e.message : e).slice(0, 500) } }))
        .catch(() => {});
    }
    throw e;
  }
  let summary: unknown = null;
  try {
    summary = await res.clone().json();
  } catch {
    summary = null;
  }
  const ok = res.ok && (summary as { ok?: boolean } | null)?.ok !== false;
  await finishCheckIn(ok);
  if (started) {
    const text = JSON.stringify(summary ?? null);
    await Promise.resolve()
      .then(() =>
        db.cronRun.update({
          where: { id: started!.id },
          data: {
            finishedAt: new Date(),
            ok,
            summary: text.length <= 4000 ? ((summary as object) ?? undefined) : { truncated: true },
          },
        }),
      )
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
  const pairs = await Promise.all(
    jobs.map(async (job) => {
      const [last, lastOk] = await Promise.all([
        db.cronRun.findFirst({ where: { job }, orderBy: { startedAt: "desc" }, select: { startedAt: true, ok: true } }),
        db.cronRun.findFirst({ where: { job, ok: true }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
      ]);
      return [job, { lastStartedAt: last?.startedAt.toISOString() ?? null, lastOkAt: lastOk?.startedAt.toISOString() ?? null, lastOk: last?.ok ?? null }] as const;
    }),
  );
  return Object.fromEntries(pairs) as Record<string, { lastStartedAt: string | null; lastOkAt: string | null; lastOk: boolean | null }>;
}

/** Each job and how long it may go without a successful run before it is late. */
export const JOB_SLA_MINUTES: Record<string, number> = {
  reminders: 90,
  notifications: 30,
  subscriptions: 26 * 60,
  operations: 30,
  access: 20,
  integrations: 20,
  translations: 26 * 60,
};
