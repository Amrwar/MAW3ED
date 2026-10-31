/**
 * The dashboard's live booking stream, shared and bounded.
 *
 * One connection per browser tab, however many components listen (the
 * header's notifications and the bookings page both do): the first
 * subscriber opens it, the last one to leave closes it and cancels any
 * pending reconnect. Two components used to open two streams, and the
 * server polls the database every 3 s for each one.
 *
 * Reconnection is bounded. A stream ends for ordinary reasons — the
 * server rotates every connection after 30 minutes, a deploy, a network
 * blip — and those reconnect at once and succeed, which resets the count.
 * It also ends for permanent ones — signed out, access withdrawn — which
 * an EventSource cannot tell apart (its error event carries no status).
 * Those used to be retried every 30 s for as long as the tab stayed open.
 * Now: back off 2, 4, 8, 16, then 30 s, and give up after
 * MAX_CONSECUTIVE_FAILURES failures in a row without a successful open —
 * about two and a half minutes of trying. The page keeps working without
 * live updates (every action refetches), and mounting it again starts a
 * fresh attempt.
 *
 * Framework-free so it is tested in Node with fake timers.
 */

export interface StreamSource {
  addEventListener(type: string, listener: (e: { data?: string }) => void): void;
  close(): void;
}

export type BookingStreamEvent =
  | { type: "BOOKING_CREATED"; payload: unknown }
  | { type: "BOOKING_UPDATED"; payload: unknown };

/** Failures in a row, without one successful open, before giving up. */
export const MAX_CONSECUTIVE_FAILURES = 8;
const FIRST_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

export function reconnectDelay(failures: number): number {
  return Math.min(FIRST_DELAY_MS * 2 ** Math.max(0, failures - 1), MAX_DELAY_MS);
}

export interface BookingStreamDeps {
  makeSource: () => StreamSource;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export function createBookingStream(deps: BookingStreamDeps) {
  const listeners = new Set<(e: BookingStreamEvent) => void>();
  let source: StreamSource | null = null;
  let timer: unknown = null;
  let failures = 0;
  let gaveUp = false;

  function emit(type: BookingStreamEvent["type"], raw: { data?: string }) {
    let payload: unknown;
    try {
      payload = JSON.parse(raw.data ?? "null");
    } catch {
      return; // malformed payload — ignored
    }
    for (const l of [...listeners]) l({ type, payload } as BookingStreamEvent);
  }

  function connect() {
    timer = null;
    if (!listeners.size || gaveUp) return;
    const s = deps.makeSource();
    source = s;
    s.addEventListener("open", () => {
      failures = 0;
    });
    s.addEventListener("BOOKING_CREATED", (e) => emit("BOOKING_CREATED", e));
    s.addEventListener("BOOKING_UPDATED", (e) => emit("BOOKING_UPDATED", e));
    s.addEventListener("error", () => {
      if (source !== s) return; // a stale source's late error
      s.close();
      source = null;
      failures++;
      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        gaveUp = true;
        return;
      }
      if (listeners.size) timer = deps.setTimer(connect, reconnectDelay(failures));
    });
  }

  function teardown() {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
    source?.close();
    source = null;
    failures = 0;
    gaveUp = false;
  }

  return {
    subscribe(listener: (e: BookingStreamEvent) => void): () => void {
      listeners.add(listener);
      if (listeners.size === 1) connect();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) teardown();
      };
    },
    /** For tests and diagnostics. */
    state: () => ({ listeners: listeners.size, connected: source !== null, failures, gaveUp, pending: timer !== null }),
  };
}

let shared: ReturnType<typeof createBookingStream> | null = null;

/** The tab's one stream (browser only). */
export function bookingStream() {
  if (!shared) {
    shared = createBookingStream({
      makeSource: () => new EventSource("/api/realtime/bookings") as unknown as StreamSource,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    });
  }
  return shared;
}
