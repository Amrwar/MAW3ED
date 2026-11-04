import { db } from "@/lib/db";
import { JOB_SLA_MINUTES, lastRuns } from "./cron-run";

/**
 * The platform's health (docs/enterprise/OPERATIONS_RUNBOOK.md): whether
 * the database answers, whether each scheduled job has succeeded within
 * its allowance, and how much is waiting or has been given up on in each
 * queue. Counts only — nothing about any customer or business.
 */
export interface HealthReport {
  status: "ok" | "degraded" | "down";
  db: { ok: boolean; ms: number };
  jobs: Record<string, { lastOkAt: string | null; late: boolean }>;
  queues: {
    notificationsDead24h: number;
    notificationsRetrying: number;
    accessJobsPending: number;
    accessJobsDead24h: number;
    webhooksRetrying: number;
    webhooksDead24h: number;
    webhookEndpointsDisabled: number;
    paymentsPendingOver1h: number;
  };
}

export async function healthReport(now: Date = new Date()): Promise<HealthReport> {
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    return {
      status: "down",
      db: { ok: false, ms: Date.now() - t0 },
      jobs: {},
      queues: { notificationsDead24h: 0, notificationsRetrying: 0, accessJobsPending: 0, accessJobsDead24h: 0, webhooksRetrying: 0, webhooksDead24h: 0, webhookEndpointsDisabled: 0, paymentsPendingOver1h: 0 },
    };
  }
  const dbMs = Date.now() - t0;
  const day = new Date(now.getTime() - 86_400_000);
  const [runs, nDead, nRetry, aPending, aDead, wRetry, wDead, wDisabled, pPending] = await Promise.all([
    lastRuns(Object.keys(JOB_SLA_MINUTES)),
    db.notificationDelivery.count({ where: { status: "DEAD", updatedAt: { gte: day } } }),
    db.notificationDelivery.count({ where: { status: "FAILED" } }),
    db.accessSyncJob.count({ where: { status: "PENDING" } }),
    db.accessSyncJob.count({ where: { status: "DEAD", updatedAt: { gte: day } } }),
    db.webhookDelivery.count({ where: { status: "FAILED" } }),
    db.webhookDelivery.count({ where: { status: "DEAD", updatedAt: { gte: day } } }),
    db.webhookEndpoint.count({ where: { status: "DISABLED", disabledReason: { not: "switched off" } } }),
    db.payment.count({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 3_600_000) } } }),
  ]);
  const jobs: HealthReport["jobs"] = {};
  let late = false;
  for (const [job, r] of Object.entries(runs)) {
    const sla = JOB_SLA_MINUTES[job];
    // A job that has never run is not "late" (a fresh deployment); one
    // whose last success is older than its allowance is.
    const isLate = !!r.lastStartedAt && (!r.lastOkAt || now.getTime() - new Date(r.lastOkAt).getTime() > sla * 60_000);
    jobs[job] = { lastOkAt: r.lastOkAt, late: isLate };
    if (isLate) late = true;
  }
  const queues = {
    notificationsDead24h: nDead, notificationsRetrying: nRetry, accessJobsPending: aPending, accessJobsDead24h: aDead,
    webhooksRetrying: wRetry, webhooksDead24h: wDead, webhookEndpointsDisabled: wDisabled, paymentsPendingOver1h: pPending,
  };
  const degraded = late || dbMs > 2_000 || aDead > 0 || nDead > 50;
  return { status: degraded ? "degraded" : "ok", db: { ok: true, ms: dbMs }, jobs, queues };
}
