import { notify } from "@/lib/notifications";
import { redriveNotifications } from "@/lib/notifications/outbox";
import { cairoWallClock } from "@/lib/bookings/instants";
import { authorizeCron } from "@/lib/security/cron-auth";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/notifications
 *
 * Every ten minutes (vercel.json): sends again whatever the outbox says
 * is due — a delivery the provider refused and whose backoff has
 * elapsed, or one claimed by a process that never reported back. The
 * dispatcher's own claim logic decides which rows those are, so a
 * message that already arrived is never sent twice.
 *
 * Security: Vercel attaches Authorization: Bearer <CRON_SECRET>; with
 * no secret set the job refuses to run (lib/security/cron-auth).
 */
export async function GET(req: Request) {
  const allowed = authorizeCron(req, "notifications");
  if (!allowed.ok) return allowed.response;

  const now = new Date();
  try {
    const result = await redriveNotifications(notify, now, cairoWallClock(now));
    return Response.json({ ok: true, at: now.toISOString(), ...result });
  } catch (e) {
    log.error("[notifications cron] re-drive failed", e);
    return Response.json({ ok: false, at: now.toISOString() }, { status: 500 });
  }
}
