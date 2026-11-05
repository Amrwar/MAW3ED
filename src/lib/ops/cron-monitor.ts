import * as Sentry from "@sentry/nextjs";

/**
 * Sentry Cron Monitors for the scheduled jobs: each run checks in when it
 * starts and when it ends, so Sentry alerts when a job fails, runs too
 * long, or does not run at all. CronRun (lib/ops/cron-run) remains the
 * record; this only adds the "it never ran" alert that a table cannot give.
 *
 * Schedules mirror vercel.json (a test keeps them equal). Monitors are
 * created in Sentry on the first check-in (upsert), so nothing is set up
 * by hand.
 *
 * Only the production site checks in. The staging project is also a
 * Vercel "production" deployment and runs the same crons; its check-ins
 * would otherwise land on the same monitors.
 */
export const CRON_SCHEDULES: Record<string, string> = {
  reminders: "0 * * * *",
  notifications: "*/10 * * * *",
  subscriptions: "0 5 * * *",
  operations: "*/10 * * * *",
  integrations: "*/5 * * * *",
  access: "*/5 * * * *",
};

export const monitorSlug = (job: string) => `cron-${job}`;

export function monitorsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.SENTRY_CRON_MONITORS === "0") return false;
  if (env.VERCEL_ENV !== "production") return false;
  const host = (env.VERCEL_PROJECT_PRODUCTION_URL ?? "").toLowerCase();
  return host === "maw3ed.net" || host.endsWith(".maw3ed.net");
}

/** Starts a check-in; returns the function that ends it. Never throws. */
export function startCheckIn(job: string): (ok: boolean) => Promise<void> {
  const schedule = CRON_SCHEDULES[job];
  if (!schedule || !monitorsEnabled()) return async () => {};
  const slug = monitorSlug(job);
  let id: string | undefined;
  try {
    id = Sentry.captureCheckIn(
      { monitorSlug: slug, status: "in_progress" },
      {
        schedule: { type: "crontab", value: schedule },
        timezone: "UTC",
        // Vercel may start a run a little late; every job is cut at 300 s.
        checkinMargin: 5,
        maxRuntime: 6,
        // One failed run is retried by the next; two in a row is an issue.
        failureIssueThreshold: 2,
        recoveryThreshold: 1,
      },
    );
  } catch {
    return async () => {};
  }
  return async (ok: boolean) => {
    try {
      Sentry.captureCheckIn({ checkInId: id, monitorSlug: slug, status: ok ? "ok" : "error" });
      // The function may be frozen right after responding.
      await Sentry.flush(2000);
    } catch {
      /* monitoring must never fail a job */
    }
  };
}
