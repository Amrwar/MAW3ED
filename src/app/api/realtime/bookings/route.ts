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
 */
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
  /** And a hard ceiling: the client reconnects, and the check at connect runs again. */
  const MAX_LIFETIME_MS = 30 * 60_000;

  // ── Stream setup ──────────────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Track last check time — only emit events for bookings updated after this point
      let lastCheck = new Date();
      let closed = false;

      function enqueue(chunk: string) {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      }

      // SSE heartbeat comment keeps the connection alive through proxies / load balancers
      function sendHeartbeat() {
        enqueue(": heartbeat\n\n");
      }

      function sendEvent(event: string, data: Record<string, unknown>) {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      // Send immediate heartbeat so the client knows the connection is ready
      sendHeartbeat();

      let ticks = 0;
      function end() {
        if (closed) return;
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      }

      // Poll DB every 3 seconds for bookings changed since lastCheck
      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          ticks++;
          if (Date.now() - openedAt.getTime() > MAX_LIFETIME_MS) return end();
          if (ticks % RECHECK_TICKS === 0 && !(await stillAllowed())) {
            log.info("[realtime/bookings] stream ended: access no longer holds", { businessId });
            return end();
          }
          if (closed) return;

          const checkFrom = lastCheck;
          lastCheck = new Date();

          const changed = await db.booking.findMany({
            where: {
              ...scope,
              updatedAt: { gt: checkFrom },
            },
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
              service: { select: { nameAr: true, duration: true } },
            },
          });

          for (const b of changed) {
            const isNew = b.createdAt >= checkFrom;
            const payload = {
              id:              b.id,
              customerName:    b.customerName,
              customerPhone:   b.customerPhone,
              serviceName:     b.service.nameAr,
              serviceDuration: b.service.duration,
              date:            b.date.toISOString().split("T")[0],
              startTime:       b.startTime,
              endTime:         b.endTime,
              status:          b.status,
              totalPrice:      Number(b.totalPrice),
              currency:        b.currency,
              notes:           b.notes,
              customerNotes:   null,
              createdAt:       b.createdAt.toISOString(),
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
        }
      }, 3000);

      // Heartbeat every 20 s to keep idle connections alive
      const heartbeatInterval = setInterval(sendHeartbeat, 20_000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", end);
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
