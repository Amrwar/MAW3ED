import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const session = await auth();
  if (!session?.user?.businessId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const businessId = session.user.businessId;

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

      // Poll DB every 3 seconds for bookings changed since lastCheck
      const pollInterval = setInterval(async () => {
        if (closed) return;
        try {
          const checkFrom = lastCheck;
          lastCheck = new Date();

          const changed = await db.booking.findMany({
            where: {
              businessId,
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
            };

            sendEvent(isNew ? "BOOKING_CREATED" : "BOOKING_UPDATED", payload);
          }
        } catch {
          // DB errors are transient — log and continue rather than closing the stream
          console.error("[realtime/bookings] poll error");
        }
      }, 3000);

      // Heartbeat every 20 s to keep idle connections alive
      const heartbeatInterval = setInterval(sendHeartbeat, 20_000);

      // Clean up when the client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });
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
