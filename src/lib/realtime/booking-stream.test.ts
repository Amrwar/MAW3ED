import { afterEach, describe, expect, it, vi } from "vitest";
import { createBookingStream, MAX_CONSECUTIVE_FAILURES, reconnectDelay, STABLE_MS, type StreamSource } from "./booking-stream";

/**
 * Loop audit (Phase 22 post-audit): the dashboard's live stream is one
 * connection per tab, reconnects with bounded attempts (refused OR
 * accepted-then-dropped), recovers on events after stopping, isolates
 * listeners, and leaves nothing running after the last subscriber leaves.
 */

class FakeSource implements StreamSource {
  static made: FakeSource[] = [];
  listeners = new Map<string, ((e: { data?: string }) => void)[]>();
  closed = false;
  constructor(public since: string | null = null, public resume: { awayMs: number | null; loadedAgoMs: number } | null = null) {
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
const last = () => FakeSource.made.at(-1)!;

function setup() {
  FakeSource.made = [];
  vi.useFakeTimers();
  const report = vi.fn();
  const stream = createBookingStream({
    makeSource: (since, resume) => new FakeSource(since, resume),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    now: () => Date.now(),
    report,
  });
  return { stream, report };
}

// A failed assertion must not leave fake timers behind for other tests.
afterEach(() => {
  vi.useRealTimers();
});

describe("one connection per tab", () => {
  it("however many components listen, and closes with the last", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const a = vi.fn();
    const b = vi.fn();
    const offA = stream.subscribe(a);
    const offB = stream.subscribe(b);
    expect(FakeSource.made).toHaveLength(1);
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "1" }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeSource.made[0].closed).toBe(true);
  });

  it("an unsubscribe immediately followed by a subscribe (StrictMode, a page swap) keeps the one connection", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const off = stream.subscribe(() => {});
    off();
    stream.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(10);
    expect(FakeSource.made).toHaveLength(1);
    expect(FakeSource.made[0].closed).toBe(false);
  });
});

describe("bounded reconnection", () => {
  it("a connection refused every time stops after the cap, and stays stopped", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    for (let i = 0; i < 50; i++) {
      last().fire("error");
      await vi.advanceTimersByTimeAsync(31_000);
    }
    expect(FakeSource.made).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    expect(stream.state()).toMatchObject({ gaveUp: true, pending: false, connected: false });
    await vi.advanceTimersByTimeAsync(6 * 60 * 60_000);
    expect(FakeSource.made).toHaveLength(MAX_CONSECUTIVE_FAILURES);
  });

  it("a connection accepted and dropped at once also counts, so that churn is bounded too", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    for (let i = 0; i < 50; i++) {
      last().fire("open");
      last().fire("error"); // dropped right after opening
      await vi.advanceTimersByTimeAsync(31_000);
    }
    expect(FakeSource.made).toHaveLength(MAX_CONSECUTIVE_FAILURES);
    expect(stream.state().gaveUp).toBe(true);
  });

  it("stable sessions that end normally (server rotation) reconnect indefinitely", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES * 3; i++) {
      last().fire("open");
      await vi.advanceTimersByTimeAsync(STABLE_MS + 1);
      last().fire("error");
      await vi.advanceTimersByTimeAsync(2_001);
    }
    expect(stream.state().gaveUp).toBe(false);
    expect(FakeSource.made.length).toBe(MAX_CONSECUTIVE_FAILURES * 3 + 1);
  });

  it("backs off 2, 4, 8, 16, then 30 seconds", () => {
    expect([1, 2, 3, 4, 5, 6, 20].map(reconnectDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("recovery after stopping is triggered by events, never by a timer", () => {
  async function stopped() {
    const ctx = setup();
    ctx.stream.subscribe(() => {});
    for (let i = 0; i < MAX_CONSECUTIVE_FAILURES; i++) {
      last().fire("error");
      await vi.advanceTimersByTimeAsync(31_000);
    }
    expect(ctx.stream.state().gaveUp).toBe(true);
    return ctx;
  }

  it("revive (online / tab visible) makes one fresh attempt with a fresh count", { timeout: 5000 }, async () => {
    const { stream } = await stopped();
    const before = FakeSource.made.length;
    stream.revive();
    expect(FakeSource.made.length).toBe(before + 1);
    expect(stream.state()).toMatchObject({ gaveUp: false, failures: 0, connected: true });
    // A second revive while connected does nothing.
    stream.revive();
    expect(FakeSource.made.length).toBe(before + 1);
  });

  it("a new component subscribing while another is still attached revives it", { timeout: 5000 }, async () => {
    const { stream } = await stopped();
    const before = FakeSource.made.length;
    stream.subscribe(() => {});
    expect(FakeSource.made.length).toBe(before + 1);
    expect(stream.state().gaveUp).toBe(false);
  });

  it("unsubscribing during a pending reconnect cancels it; nothing keeps running", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const off = stream.subscribe(() => {});
    last().fire("error");
    expect(stream.state().pending).toBe(true);
    off();
    await vi.advanceTimersByTimeAsync(1);
    expect(stream.state()).toMatchObject({ pending: false, connected: false, listeners: 0 });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSource.made).toHaveLength(1);
  });
});

describe("delivery", () => {
  it("one failing listener does not starve the others, and is reported", () => {
    const { stream, report } = setup();
    const before = vi.fn();
    const bad = vi.fn(() => {
      throw new Error("handler bug");
    });
    const after = vi.fn();
    stream.subscribe(before);
    stream.subscribe(bad);
    stream.subscribe(after);
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "1" }));
    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("delivers objects only: invalid JSON, null, arrays and primitives are dropped", () => {
    const { stream } = setup();
    const l = vi.fn();
    stream.subscribe(l);
    for (const data of ["{not json", "null", "[]", "42", '"x"', undefined]) last().fire("BOOKING_UPDATED", data);
    expect(l).not.toHaveBeenCalled();
    last().fire("BOOKING_UPDATED", JSON.stringify({ id: "1", status: "CONFIRMED", customerName: "x" }));
    expect(l).toHaveBeenCalledWith({ type: "BOOKING_UPDATED", payload: { id: "1", status: "CONFIRMED", customerName: "x" } });
  });
});

describe("resuming without repeats (P23-A9, P23-A10)", () => {
  it("reconnects from the last checkpoint the server sent", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    expect(last().since).toBeNull();
    last().fire("open");
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:00:00.000Z" }));
    await vi.advanceTimersByTimeAsync(STABLE_MS);
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:04:40.000Z" }));
    last().fire("error");
    await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    expect(FakeSource.made).toHaveLength(2);
    expect(last().since).toBe("2026-11-02T10:04:40.000Z");
  });

  it("a malformed checkpoint leaves the last good one", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:00:00.000Z" }));
    last().fire("checkpoint", "{not json");
    last().fire("error");
    await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    expect(last().since).toBe("2026-11-02T10:00:00.000Z");
  });

  it("delivers a change once, however many streams send it, and a newer version again", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const heard = vi.fn();
    stream.subscribe(heard);
    const v1 = JSON.stringify({ id: "b1", status: "PENDING", updatedAt: "2026-11-02T10:00:01.000Z" });
    last().fire("BOOKING_CREATED", v1);
    last().fire("BOOKING_CREATED", v1);
    last().fire("error");
    await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    last().fire("BOOKING_CREATED", v1); // the resumed stream's overlap
    expect(heard).toHaveBeenCalledTimes(1);
    last().fire("BOOKING_UPDATED", JSON.stringify({ id: "b1", status: "CONFIRMED", updatedAt: "2026-11-02T10:00:09.000Z" }));
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("a booking already announced as new is delivered as an update when a resumed stream calls it new again", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const heard: string[] = [];
    stream.subscribe((e) => heard.push(e.type));
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "b2", updatedAt: "2026-11-02T10:00:01.000Z" }));
    last().fire("error");
    await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "b2", updatedAt: "2026-11-02T10:00:05.000Z" }));
    expect(heard).toEqual(["BOOKING_CREATED", "BOOKING_UPDATED"]);
  });

  it("the next page in the tab resumes where the last one stopped, and nothing is announced twice", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const off = stream.subscribe(() => {});
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:00:00.000Z" }));
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "b3", updatedAt: "2026-11-02T10:00:01.000Z" }));
    off();
    await vi.advanceTimersByTimeAsync(1);
    const heard = vi.fn();
    stream.subscribe(heard);
    expect(last().since).toBe("2026-11-02T10:00:00.000Z");
    last().fire("BOOKING_CREATED", JSON.stringify({ id: "b3", updatedAt: "2026-11-02T10:00:01.000Z" }));
    expect(heard).not.toHaveBeenCalled();
  });

  it("passes on the server's resync, so a page can reload what it could not resume", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const heard: string[] = [];
    stream.subscribe((e) => heard.push(e.type));
    last().fire("resync", JSON.stringify({}));
    expect(heard).toEqual(["BOOKINGS_RESYNC"]);
  });

  it("says when the page loaded, keeps it across reconnects, and renews it for the next page", { timeout: 5000 }, async () => {
    const { stream } = setup();
    const off = stream.subscribe(() => {});
    const loadedAt = Date.now();
    expect(last().resume!.loadedAgoMs).toBe(0);
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:00:00.000Z" }));
    await vi.advanceTimersByTimeAsync(3_000);
    // A heartbeat repeating the same checkpoint does not restart the away time.
    last().fire("checkpoint", JSON.stringify({ at: "2026-11-02T10:00:00.000Z" }));
    last().fire("error");
    await vi.advanceTimersByTimeAsync(reconnectDelay(1));
    // A routine reconnect: the same page, so the same load time; away = since the checkpoint arrived.
    expect(last().resume!.loadedAgoMs).toBe(Date.now() - loadedAt);
    expect(last().resume!.awayMs).toBe(3_000 + reconnectDelay(1));
    off();
    await vi.advanceTimersByTimeAsync(5_000);
    stream.subscribe(() => {});
    // The next page: a new load time, the checkpoint kept.
    expect(last().resume!.loadedAgoMs).toBe(0);
    expect(last().since).toBe("2026-11-02T10:00:00.000Z");
  });

  it("sends no away time without a checkpoint", { timeout: 5000 }, async () => {
    const { stream } = setup();
    stream.subscribe(() => {});
    expect(last().resume!.awayMs).toBeNull();
  });
});
