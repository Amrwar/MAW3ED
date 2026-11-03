import { describe, expect, it, vi } from "vitest";
import { RECHECK_MS, recheckSession, restoreSession, type RecheckDeps, type RestoreDeps } from "./restore";
import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { AuthUser } from "./roles";

const me: AuthUser = { id: "u1", name: "Sara", email: null, businessId: null, adminRole: null };

function deps(fetchMe: () => Promise<AuthUser>, over: Partial<RestoreDeps> = {}) {
  const d = {
    hasTokens: vi.fn(async () => true),
    fetchMe: vi.fn(fetchMe),
    clearTokens: vi.fn(async () => undefined),
    lastUser: vi.fn(async () => me),
    rememberUser: vi.fn(async () => undefined),
    ...over,
  };
  return d;
}

describe("restoring the session on a cold start", () => {
  it("no tokens: nobody, and nothing asked", async () => {
    const d = deps(async () => me, { hasTokens: vi.fn(async () => false) });
    expect(await restoreSession(d)).toEqual({ user: null, verified: true });
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("the server answers: that account, remembered for next time", async () => {
    const d = deps(async () => me);
    expect(await restoreSession(d)).toEqual({ user: me, verified: true });
    expect(d.rememberUser).toHaveBeenCalledWith(me);
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("the server says the session is over: signed out, tokens gone", async () => {
    const d = deps(async () => {
      throw new UnauthorizedError();
    });
    expect(await restoreSession(d)).toEqual({ user: null, verified: true });
    expect(d.clearTokens).toHaveBeenCalledOnce();
  });

  it("no signal: still signed in as the last known account, tokens kept, not verified", async () => {
    const d = deps(async () => {
      throw new NetworkError(new Error("offline"));
    });
    expect(await restoreSession(d)).toEqual({ user: me, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("a server error is not a sign-out either", async () => {
    const d = deps(async () => {
      throw new ApiError(503, "busy");
    });
    expect(await restoreSession(d)).toEqual({ user: me, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("offline with no remembered account: nobody shown, but the tokens are still kept", async () => {
    const d = deps(
      async () => {
        throw new NetworkError(new Error("offline"));
      },
      { lastUser: vi.fn(async () => null) },
    );
    expect(await restoreSession(d)).toEqual({ user: null, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });
});

describe("asking again after a launch shown from memory", () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  function rig(fetchMe: () => Promise<AuthUser>, over: Partial<RecheckDeps> = {}) {
    const timers: { fn: () => void; ms: number }[] = [];
    let listener: (() => void) | undefined;
    let stale = false;
    const d = {
      fetchMe: vi.fn(fetchMe),
      clearTokens: vi.fn(async () => undefined),
      rememberUser: vi.fn(async () => undefined),
      isOnline: vi.fn(() => true),
      onConnectionChange: (fn: () => void) => {
        listener = fn;
        return () => (listener = undefined);
      },
      isStale: () => stale,
      confirmed: vi.fn(),
      signedOut: vi.fn(),
      setTimer: (fn: () => void, ms: number) => timers.push({ fn, ms }),
      clearTimer: vi.fn(),
      ...over,
    };
    return { d, timers, online: () => listener?.(), goStale: () => (stale = true), hasListener: () => !!listener };
  }

  it("the server answers: that account, confirmed", async () => {
    const { d } = rig(async () => me);
    recheckSession(d);
    await flush();
    expect(d.confirmed).toHaveBeenCalledWith(me);
    expect(d.rememberUser).toHaveBeenCalledWith(me);
  });

  it("a refusal signs out", async () => {
    const { d } = rig(async () => Promise.reject(new UnauthorizedError()));
    recheckSession(d);
    await flush();
    expect(d.clearTokens).toHaveBeenCalledOnce();
    expect(d.signedOut).toHaveBeenCalledOnce();
  });

  it("an answer that arrives after somebody signed in or out is dropped", async () => {
    let answer!: (u: AuthUser) => void;
    const { d, goStale } = rig(() => new Promise<AuthUser>((r) => (answer = r)));
    recheckSession(d);
    goStale();
    answer(me);
    await flush();
    expect(d.confirmed).not.toHaveBeenCalled();
  });

  it("a late refusal does not clear the tokens of whoever signed in since", async () => {
    let refuse!: (e: unknown) => void;
    const { d, goStale } = rig(() => new Promise<AuthUser>((_, j) => (refuse = j)));
    recheckSession(d);
    goStale();
    refuse(new UnauthorizedError());
    await flush();
    expect(d.clearTokens).not.toHaveBeenCalled();
    expect(d.signedOut).not.toHaveBeenCalled();
  });

  it("a failing server is asked again, further apart, a bounded number of times", async () => {
    const { d, timers } = rig(async () => Promise.reject(new NetworkError()));
    recheckSession(d);
    for (let i = 0; i < 10; i++) {
      await flush();
      const t = timers.shift();
      if (!t) break;
      t.fn();
    }
    await flush();
    expect(d.fetchMe).toHaveBeenCalledTimes(1 + RECHECK_MS.length);
    expect(d.signedOut).not.toHaveBeenCalled();
  });

  it("waits for the connection when offline, and stops cleanly", async () => {
    let online = false;
    const { d, online: reconnect, hasListener } = rig(async () => me, { isOnline: () => online });
    const stop = recheckSession(d);
    await flush();
    expect(d.fetchMe).not.toHaveBeenCalled();
    online = true;
    reconnect();
    await flush();
    expect(d.confirmed).toHaveBeenCalledWith(me);
    stop();
    expect(hasListener()).toBe(false);
  });
});
