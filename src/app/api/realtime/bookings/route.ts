import { err } from "@/lib/api";
import { bookingScope, requireBusinessAccess, type BusinessActor } from "@/lib/business-access";
import { resolveDelegation } from "@/lib/organizations/delegation";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * GET /api/realtime/bookings
 *
 * Server-Sent Events stream. Authenticated business owners connect here
 * and receive BOOKING_CREATED / BOOKING_UPDATED events in near-real-time.
 *
 * Implementation: DB polling every 3 s (compatible with Vercel serverless).
 * No shared in-memory state required — each client independently queries
 * for bookings updated since the connection was established.
 *
 * Security: only events for the authenticated business are emitted.
 *
 * Each connection lives just under the platform's limit and then closes
 * cleanly; the client reconnects with `?since=` set to the last
 * checkpoint this stream sent, so nothing changed in between is lost.
 */

/** The platform's ceiling for this function (Vercel, Fluid Compute). */
export const maxDuration = 300;

/**
 * How far back each poll looks again. The window is compared against
 * `updatedAt`, which the app server stamps with its own clock; two
 * instances whose clocks differ could otherwise put a change just behind
 * the window and the live view would miss it (P23-A9). Repeats inside
 * the overlap are dropped by id and `updatedAt`.
 */
const OVERLAP_MS = 5_000;
/**
 * The oldest `since` a reconnecting client may resume from. Longer than
 * the client's own backoff across its retries (about two minutes), so a
 * deploy or a short outage does not drop what changed meanwhile.
 */
const MAX_RESUME_MS = 15 * 60_000;
/** Rows one poll reads at most; a longer backlog is read over several polls. */
const POLL_LIMIT = 500;

/** A client's resume point: a recent instant, not one in the future. */
function resumeFrom(req: Request, now: Date): Date | null {
  const raw = new URL(req.url).searchParams.get("since");
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() > now.getTime() || now.getTime() - at.getTime() > MAX_RESUME_MS) return null;
  return at;
}

export async function GET(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────
  // The business is re-read and its ownership checked, not taken from
  // the token's snapshot (lib/api requireBusiness): a stream is held
  // open for a long time, and must not keep flowing to an account that
  // has stopped owning the business.
  let businessId: string;
  let userId: string;
  let role: BusinessActor["role"];
  // What this stream may carry: the whole business for the owner, a
  // delegate's granted (possibly branch-limited) bookings. Recomputed on
  // every recheck, so narrowing a grant narrows an open stream.
  let scope: ReturnType<typeof bookingScope>;
  try {
    const got = await requireBusinessAccess("bookings.read");
    // The web dashboard's stream: the owner, or a delegate operating the
    // business. Staff use the app, as before.
    if (got.actor.role !== "OWNER" && got.actor.role !== "DELEGATE") throw err("Unauthorized", 401);
    businessId = got.business.id;
    userId = got.session.user.id;
    role = got.actor.role;
    scope = bookingScope(got.business, got.actor);
  } catch (e) {
    if (e instanceof Response) return new Response("Unauthorized", { status: e.status === 404 ? 401 : e.status });
    throw e;
  }
  const openedAt = new Date();
  // Resuming from the client's last checkpoint, or starting now. A resume
  // point that was offered but is too old is refused, and the client is
  // told to reload (`resync`) rather than silently missing what changed.
  const offered = new URL(req.url).searchParams.has("since");
  const resumed = resumeFrom(req, openedAt);
  // The window looks OVERLAP_MS behind where it starts, as behind every
  // poll: a change made between the page loading its data and this
  // connection, or stamped by a slower clock, is not missed. On a fresh
  // connection what it finds there happened before the page was live and
  // is marked `replayed` — shown, but not announced with a chime.

  /**
   * Whether this connection may go on: the account still owns the
   * business and its sessions were not revoked since it opened. Asked
   * again every RECHECK_TICKS polls, because a stream outlives the check
   * at connect by hours, and a revoked or transferred account must not
   * keep receiving customers' names and numbers until the tab closes.
   */
  async function stillAllowed(): Promise<boolean> {
    const [biz, user] = await Promise.all([
      db.business.findUnique({ where: { id: businessId }, select: { ownerId: true } }),
      db.user.findUnique({ where: { id: userId }, select: { sessionsRevokedAt: true } }),
    ]);
    if (!biz || !user) return false;
    if (user.sessionsRevokedAt && user.sessionsRevokedAt > openedAt) return false;
    if (role === "OWNER") return biz.ownerId === userId;
    const delegation = await resolveDelegation(userId, businessId, new Date());
    if (!delegation?.actions.includes("bookings.read")) return false;
    scope = bookingScope({ id: businessId }, { role: "DELEGATE", userId, staffMemberId: null, delegation });
    return true;
  }
  /** Every 10 polls (30 s). */
  const RECHECK_TICKS = 10;
  /**
   * And a ceiling just under maxDuration: the stream closes cleanly, the
   * client resumes from the last checkpoint, and the check at connect
   * runs again. It used to be 30 minutes, but the platform cut every
   * stream at 5 (P23-A10) — mid-poll, with nothing to resume from.
   */
  const MAX_LIFETIME_MS = 280_000;

  // ── Stream setup ──────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  /** Stops the polling; set once the stream starts. */
  let stop = () => {};
  const stream = new ReadableStream({
    // The platform cancelled the body (the client went away): stop.
    cancel() {
      stop();
    },
    start(controller) {
      // Track last check time — only emit events for bookings updated after this point
      let lastCheck = resumed ?? openedAt;
      let closed = false;
      // What this stream has sent, by id → updatedAt, so the overlap does
      // not send a change twice. Entries older than the window are let go.
      const sent = new Map<string, number>();

      function enqueue(chunk: string) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The body was cancelled under us: nothing more can be sent.
          stop();
        }
      }

      /** Where a client resumes from if this stream ends: everything before it was sent. */
      function sendCheckpoint() {
        sendEvent("checkpoint", { at: lastCheck.toISOString() });
      }

      // SSE heartbeat comment keeps the connection alive through proxies /
      // load balancers, and carries the checkpoint.
      function sendHeartbeat() {
        enqueue(": heartbeat\n\n");
        sendCheckpoint();
      }

      function sendEvent(event: string, data: Record<string, unknown>) {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      // Send immediate heartbeat so the client knows the connection is ready
      sendHeartbeat();
      if (offered && !resumed) sendEvent("resync", {});

      let ticks = 0;
      // One poll at a time: a slow one is not overlapped by the next,
      // which would read the same window and send its bookings twice.
      let polling = false;
      /** Stops the polling and the heartbeat; nothing more is sent. */
      stop = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed or cancelled */ }
      };
      /** Ends cleanly: the checkpoint the client resumes from, then stop. */
      function end() {
        if (closed) return;
        sendCheckpoint();
        stop();
      }

      // Poll DB every 3 seconds for bookings changed since lastCheck
      const pollInterval = setInterval(async () => {
        if (closed || polling) return;
        polling = true;
        try {
          ticks++;
          if (Date.now() - openedAt.getTime() > MAX_LIFETIME_MS) return end();
          if (ticks % RECHECK_TICKS === 0 && !(await stillAllowed())) {
            log.info("[realtime/bookings] stream ended: access no longer holds", { businessId });
            return end();
          }
          if (closed) return;

          // The window moves forward only once this poll has everything it
          // sends: a failed query leaves it, and the next poll asks again.
          const checkFrom = lastCheck;
          const polledAt = new Date();
          // Looking a little further back than the last poll (OVERLAP_MS).
          const windowFrom = new Date(checkFrom.getTime() - OVERLAP_MS);

          const found = await db.booking.findMany({
            where: {
              ...scope,
              updatedAt: { gt: windowFrom },
            },
            orderBy: { updatedAt: "asc" },
            take: POLL_LIMIT,
            select: {
              id:              true,
              customerName:    true,
              customerPhone:   true,
              date:            true,
              startTime:       true,
              endTime:         true,
              status:          true,
              totalPrice:      true,
              currency:        true,
              notes:           true,
              createdAt:       true,
              updatedAt:       true,
              serviceId:       true,
            },
          });
          for (const [id, at] of sent) if (at <= windowFrom.getTime()) sent.delete(id);
          const changed = found.filter((b) => sent.get(b.id) !== b.updatedAt.getTime());
          // A full page means more is waiting: the next poll carries on from
          // the last row read rather than from now.
          const advanceTo = found.length === POLL_LIMIT ? found[found.length - 1].updatedAt : polledAt;
          if (changed.length === 0) {
            lastCheck = advanceTo;
            return;
          }

          // Services read separately, and only when something changed: a
          // nested select ran a second, empty query on every quiet poll
          // (Sentry MAW3ED-2, "N+1 Query" on this route).
          const services = new Map(
            (await db.service.findMany({
              where:  { id: { in: [...new Set(changed.map((b) => b.serviceId))] } },
              select: { id: true, nameAr: true, duration: true },
            })).map((s) => [s.id, s]),
          );
          lastCheck = advanceTo;

          for (const b of changed) {
            // New to this window, and not sent by this stream before.
            const isNew = b.createdAt > windowFrom && !sent.has(b.id);
            sent.set(b.id, b.updatedAt.getTime());
            const service = services.get(b.serviceId);
            const payload = {
              id:              b.id,
              customerName:    b.customerName,
              customerPhone:   b.customerPhone,
              serviceName:     service?.nameAr ?? "",
              serviceDuration: service?.duration ?? 0,
              date:            b.date.toISOString().split("T")[0],
              startTime:       b.startTime,
              endTime:         b.endTime,
              status:          b.status,
              totalPrice:      Number(b.totalPrice),
              currency:        b.currency,
              notes:           b.notes,
              customerNotes:   null,
              createdAt:       b.createdAt.toISOString(),
              // The version: lets a client drop a change it already has
              // (a resumed stream overlaps the one before it).
              updatedAt:       b.updatedAt.toISOString(),
              // Changed before this (fresh) connection: the page may already
              // show it; listeners update quietly rather than announce it.
              replayed:        !resumed && b.updatedAt <= openedAt,
              tableName:       null,
              staffName:       null,
              partySize:       null,
            };

            sendEvent(isNew ? "BOOKING_CREATED" : "BOOKING_UPDATED", payload);
          }
        } catch (e) {
          // Transient DB errors should not close the stream, but the
          // reason still needs recording — a poll that fails every tick
          // looks identical to one that never fails.
          log.error("[realtime/bookings] poll error", e);
        } finally {
          polling = false;
        }
      }, 3000);

      // Heartbeat every 20 s to keep idle connections alive
      const heartbeatInterval = setInterval(sendHeartbeat, 20_000);

      // Clean up when the client disconnects: nobody is there to read a
      // checkpoint, and writing one to a cancelled body would throw.
      req.signal.addEventListener("abort", () => stop());
      if (req.signal.aborted) stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      // Prevent nginx / Vercel edge from buffering the stream
      "X-Accel-Buffering": "no",
    },
  });
}
