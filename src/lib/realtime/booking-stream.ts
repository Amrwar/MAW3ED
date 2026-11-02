/**
 * The dashboard's live booking stream, shared and bounded.
 *
 * One connection per browser tab, however many components listen (the
 * header's notifications and the bookings page both do): the first
 * subscriber opens it, the last one to leave closes it. Two components
 * used to open two streams, and the server polls the database every 3 s
 * for each one. Closing is deferred by a tick, so an unsubscribe that is
 * immediately followed by a subscribe (React StrictMode's double mount, a
 * page swap) keeps the one connection.
 *
 * Reconnection is bounded. A stream ends for ordinary reasons — the
 * server rotates every connection after 30 minutes, a deploy, a blip —
 * and for permanent ones — signed out, access withdrawn — which an
 * EventSource cannot tell apart (its error event carries no status).
 * A connection that stayed open for STABLE_MS counts as a good session
 * and resets the count; anything shorter (refused outright, or accepted
 * and dropped at once) is a failure. After MAX_CONSECUTIVE_FAILURES in a
 * row the stream stops — no endless retry, and no endless churn of
 * connections each starting a server-side poller.
 *
 * Stopping is not forever: the browser coming back online, the tab
 * becoming visible again, or a new component subscribing revives it with
 * a fresh count. Each is a single attempt triggered by an event, never a
 * timer loop.
 *
 * One listener failing never starves another: every delivery is isolated,
 * and only object payloads are delivered.
 *
 * Framework-free so it is tested in Node with fake timers.
 */

/**
 * Changes already delivered, by booking id → version (`updatedAt`). A
 * resumed stream starts from the last checkpoint and overlaps the one
 * before it, and the server re-reads a few seconds each poll; the same
 * change must not chime twice. Bounded: the oldest entries go first.
 */
const DELIVERED_LIMIT = 1_000;

export interface StreamSource {
  addEventListener(type: string, listener: (e: { data?: string }) => void): void;
  close(): void;
}

export type BookingStreamEvent =
  | { type: "BOOKING_CREATED"; payload: Record<string, unknown> }
  | { type: "BOOKING_UPDATED"; payload: Record<string, unknown> }
  /** The server could not resume from the last checkpoint: reload. */
  | { type: "BOOKINGS_RESYNC"; payload: Record<string, unknown> };

/** Failures in a row, without one stable session, before stopping. */
export const MAX_CONSECUTIVE_FAILURES = 8;
/** How long a connection must stay open to count as a good session. */
export const STABLE_MS = 10_000;
const FIRST_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

export function reconnectDelay(failures: number): number {
  return Math.min(FIRST_DELAY_MS * 2 ** Math.max(0, failures - 1), MAX_DELAY_MS);
}

export interface BookingStreamDeps {
  /** Opens the stream, resuming from the server's last checkpoint when there is one. */
  makeSource: (since: string | null) => StreamSource;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
  /** Where a listener's error goes (it never reaches the other listeners). */
  report?: (error: unknown) => void;
}

export function createBookingStream(deps: BookingStreamDeps) {
  const listeners = new Set<(e: BookingStreamEvent) => void>();
  let source: StreamSource | null = null;
  let timer: unknown = null;
  let closing: unknown = null;
  let failures = 0;
  let gaveUp = false;
  let checkpoint: string | null = null;
  const delivered = new Map<string, string>();

  /**
   * What to deliver this event as: null for a version already delivered,
   * and "updated" for a booking already announced as new. A resumed stream
   * does not know what the one before it sent, and would announce a
   * booking it sees for the first time as new again — a second chime.
   */
  function deliverAs(type: BookingStreamEvent["type"], payload: Record<string, unknown>): BookingStreamEvent["type"] | null {
    const { id, updatedAt } = payload;
    if (typeof id !== "string" || typeof updatedAt !== "string") return type;
    const seen = delivered.get(id);
    if (seen === updatedAt) return null;
    delivered.delete(id);
    delivered.set(id, updatedAt);
    if (delivered.size > DELIVERED_LIMIT) delivered.delete(delivered.keys().next().value as string);
    return seen !== undefined && type === "BOOKING_CREATED" ? "BOOKING_UPDATED" : type;
  }

  function emit(type: BookingStreamEvent["type"], raw: { data?: string }) {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.data ?? "null");
    } catch {
      return; // malformed payload — ignored
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
    const as = deliverAs(type, payload as Record<string, unknown>);
    if (!as) return;
    for (const l of [...listeners]) {
      try {
        l({ type: as, payload: payload as Record<string, unknown> });
      } catch (error) {
        deps.report?.(error);
      }
    }
  }

  function connect() {
    timer = null;
    if (!listeners.size || gaveUp || source) return;
    const s = deps.makeSource(checkpoint);
    source = s;
    let openedAt: number | null = null;
    s.addEventListener("open", () => {
      openedAt = deps.now();
    });
    s.addEventListener("BOOKING_CREATED", (e) => emit("BOOKING_CREATED", e));
    s.addEventListener("BOOKING_UPDATED", (e) => emit("BOOKING_UPDATED", e));
    s.addEventListener("resync", (e) => emit("BOOKINGS_RESYNC", e));
    s.addEventListener("checkpoint", (e) => {
      try {
        const at = (JSON.parse(e.data ?? "null") as { at?: unknown } | null)?.at;
        if (typeof at === "string") checkpoint = at;
      } catch {
        // a malformed checkpoint is ignored; the last good one stands
      }
    });
    s.addEventListener("error", () => {
      if (source !== s) return; // a closed source's late error
      s.close();
      source = null;
      const stable = openedAt !== null && deps.now() - openedAt >= STABLE_MS;
      failures = stable ? 1 : failures + 1;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        gaveUp = true;
        return;
      }
      if (listeners.size) timer = deps.setTimer(connect, reconnectDelay(failures));
    });
  }

  function teardown() {
    closing = null;
    if (listeners.size) return; // somebody subscribed again in the meantime
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    source?.close();
    source = null;
    failures = 0;
    gaveUp = false;
    // The checkpoint and what was delivered are kept: the next page in
    // this tab resumes where the last one stopped, so nothing changed
    // during a navigation is lost, and nothing already announced is
    // announced again.
  }

  /** One fresh attempt after giving up (online, visible, a new subscriber). */
  function revive() {
    if (!gaveUp || !listeners.size) return;
    gaveUp = false;
    failures = 0;
    connect();
  }

  return {
    subscribe(listener: (e: BookingStreamEvent) => void): () => void {
      listeners.add(listener);
      if (closing !== null) {
        deps.clearTimer(closing);
        closing = null;
      }
      if (gaveUp) revive();
      else if (!source && timer === null) connect();
      return () => {
        listeners.delete(listener);
        if (!listeners.size && closing === null) closing = deps.setTimer(teardown, 0);
      };
    },
    revive,
    /** For tests and diagnostics. */
    state: () => ({ listeners: listeners.size, connected: source !== null, failures, gaveUp, pending: timer !== null }),
  };
}

let shared: ReturnType<typeof createBookingStream> | null = null;

/** The tab's one stream (browser only). */
export function bookingStream() {
  if (!shared) {
    const stream = createBookingStream({
      makeSource: (since) =>
        new EventSource(`/api/realtime/bookings${since ? `?since=${encodeURIComponent(since)}` : ""}`) as unknown as StreamSource,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      now: () => Date.now(),
      report: (error) => console.error("[live bookings] a listener failed", error),
    });
    // Events, not timers: each gives a stopped stream one fresh attempt.
    window.addEventListener("online", () => stream.revive());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") stream.revive();
    });
    shared = stream;
  }
  return shared;
}
