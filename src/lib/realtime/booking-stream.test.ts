import { describe, expect, it, vi } from "vitest";
import { createBookingStream, MAX_CONSECUTIVE_FAILURES, reconnectDelay, type StreamSource } from "./booking-stream";

/**
 * Loop audit (Phase 22 post-audit): the dashboard's live stream is one
 * connection per tab, reconnects with bounded attempts, resets on success,
 * and leaves nothing running after the last subscriber leaves.
 */

class FakeSource implements StreamSource {
  static made: FakeSource[] = [];
  listeners = new Map<string, ((e: { data?: string }) => void)[]>();
  closed = false;
  constructor() {
    FakeSource.made.push(this);
  }
  addEventListener(type: string, fn: (e: { data?: string }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  fire(type: string, data?: string) {
    for (const fn of this.listeners.get(type) ?? []) fn({ data });
  }
}

function setup() {
  FakeSource.made = [];
  vi.useFakeTimers();
  const stream = createBookingStream({
    makeSource: () => new FakeSource(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  return stream;
}

describe("the live booking stream", () => {
  it("opens one connection however many components listen, and closes with the last", { timeout: 5000 }, () => {
    const s = setup();
    const a = vi.fn();
    const b = vi.fn();
    const offA = s.subscribe(a);
    const offB = s.subscribe(b);
    expect(FakeSource.made).toHaveLength(1);
    FakeSource.made[0].fire("BOOKING_CREATED", JSON.stringify({ id: "1" }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    expect(FakeSource.made[0].closed).toBe(false);
    offB();
    expect(FakeSource.made[0].closed).toBe(true);
    vi.useRealTimers();
  });

  it("a permanent failure is retried a bounded number of times, then stops for good", { timeout: 5000 }, async () => {
    const s = setup();
    s.subscribe(() => {});
    // Every connection fails immediately (signed out, access withdrawn…).
    for (let i = 0; i < 50; i++) {
      const last = FakeSource.made.at(-1)!;
      last.fire("error");
      await vi.advanceTimersByTimeAsync(31_000);
    }
    expect(FakeSource.made).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    expect(s.state()).toMatchObject({ gaveUp: true, pending: false, connected: false });
    // Hours later, still nothing scheduled or opened.
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect(FakeSource.made).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    vi.useRealTimers();
  });

  it("an ordinary end (server rotation) reconnects, and a successful open resets the count", { timeout: 5000 }, async () => {
    const s = setup();
    s.subscribe(() => {});
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES * 3; i++) {
      const cur = FakeSource.made.at(-1)!;
      cur.fire("open");
      cur.fire("error"); // rotated after a good session
      await vi.advanceTimersByTimeAsync(2_001);
    }
    expect(s.state().gaveUp).toBe(false);
    expect(FakeSource.made.length).toBe(MAX_CONSECUTIVE_FAILURES * 3 + 1);
    vi.useRealTimers();
  });

  it("unsubscribing during a pending reconnect cancels it; nothing keeps running", { timeout: 5000 }, async () => {
    const s = setup();
    const off = s.subscribe(() => {});
    FakeSource.made[0].fire("error");
    expect(s.state().pending).toBe(true);
    off();
    expect(s.state()).toMatchObject({ pending: false, connected: false, listeners: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSource.made).toHaveLength(1);
    // Mounting again starts a fresh attempt.
    s.subscribe(() => {});
    expect(FakeSource.made).toHaveLength(2);
    vi.useRealTimers();
  });

  it("backs off 2, 4, 8, 16, then 30 seconds", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(reconnectDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it("ignores malformed payloads", () => {
    const s = setup();
    const l = vi.fn();
    s.subscribe(l);
    FakeSource.made[0].fire("BOOKING_UPDATED", "{not json");
    expect(l).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
