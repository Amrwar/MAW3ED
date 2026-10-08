import { timingSafeEqual } from "crypto";
import { log } from "@/lib/logger";

/**
 * The guard on the scheduled jobs.
 *
 * Both cron routes used to check the secret only when one was set:
 *
 *     if (!cronSecret) return true;
 *
 * which means a deployment that has not set CRON_SECRET leaves both
 * endpoints open to anyone who knows the path. They are not harmless
 * reads. /api/cron/reminders dispatches notifications to real
 * customers, and /api/cron/subscriptions moves subscriptions between
 * states. An unauthenticated trigger for outbound messaging is exactly
 * the kind of endpoint that gets found by a scanner and used.
 *
 * So this fails closed. With no secret configured the job refuses to
 * run and says why, which is a visible, one-line fix, rather than
 * running for anybody who asks, which is invisible.
 *
 * The trade-off is deliberate: reminders stopping is noticed and
 * recovered in a minute; an open endpoint is noticed by somebody else.
 */

export type CronAuth = { ok: true } | { ok: false; response: Response };

/**
 * Compares without leaking where two strings first differ.
 *
 * Over the public internet a timing attack on this is barely practical,
 * but the comparison costs nothing to get right and `===` on a secret
 * is a habit worth not having.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself
  // disclose the secret's length.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Checks the Authorization header Vercel attaches to a cron invocation.
 *
 * `job` only names the caller in the log.
 */
export function authorizeCron(req: Request, job: string): CronAuth {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    log.error(
      `[cron:${job}] refusing to run: CRON_SECRET is not set, so this endpoint cannot be authenticated`,
    );
    return {
      ok: false,
      response: new Response("Cron secret not configured", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }),
    };
  }

  const header = req.headers.get("Authorization") ?? "";
  const prefix = "Bearer ";
  const provided = header.startsWith(prefix) ? header.slice(prefix.length) : "";

  if (!provided || !secretsMatch(provided, expected)) {
    log.warn(`[cron:${job}] rejected unauthorized request`);
    return {
      ok: false,
      response: new Response("Unauthorized", {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      }),
    };
  }

  return { ok: true };
}
