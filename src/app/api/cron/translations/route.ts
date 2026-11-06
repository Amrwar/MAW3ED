/**
 * GET /api/cron/translations
 *
 * Nightly: brings every published business's machine English up to
 * date with its Arabic (lib/translate). A save already does this for
 * the business it touched, after its response; this run catches the
 * ones a failed or skipped call left behind, and on its first run
 * after deploy, every business that existed before.
 *
 * A business with nothing to translate costs one read and no model
 * call (fingerprints match), so going over all of them is cheap.
 *
 * Security: Authorization: Bearer <CRON_SECRET>, as every cron.
 */

import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { withCronRun } from "@/lib/ops/cron-run";
import { authorizeCron } from "@/lib/security/cron-auth";
import { syncBusinessTranslations, translationEnabled } from "@/lib/translate";

/** Explicit, so a slow run is cut at a known limit and recorded as failed. */
export const maxDuration = 300;

/**
 * Stop starting new businesses after this, well inside maxDuration. A
 * run cut short leaves the rest for the next night: the ones already
 * done are then a cheap read each (their fingerprints match).
 */
const BUDGET_MS = 240_000;

async function handle(req: Request): Promise<Response> {
  const allowed = authorizeCron(req, "translations");
  if (!allowed.ok) return allowed.response;

  if (!translationEnabled()) {
    log.info("[translations cron] translation is not configured; skipped");
    return Response.json({ ok: true, skipped: true });
  }

  // By id, not updatedAt: writing a translation bumps updatedAt, and an
  // updatedAt order would bring the same businesses back first forever.
  const businesses = await db.business.findMany({
    where: { isPublished: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const started = Date.now();
  let checked = 0;
  let translated = 0;
  for (const b of businesses) {
    if (Date.now() - started > BUDGET_MS) break;
    translated += await syncBusinessTranslations(b.id, { retryFailed: true });
    checked++;
  }

  log.info(`[translations cron] ${checked}/${businesses.length} business(es) checked, ${translated} field(s) translated`);
  return Response.json({ ok: true, checked, total: businesses.length, translated });
}

/** Recorded in CronRun (lib/ops/cron-run) — when it ran, whether it worked. */
export async function GET(req: Request) {
  return withCronRun("translations", req, () => handle(req));
}
