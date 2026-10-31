import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Loop audit (Phase 22 post-audit): the app's request client must reach a
 * terminal state on every path — one refresh for many 401s, one retry
 * after a refresh and never a refresh of a refresh, a refused refresh ends
 * the session once, a lost network fails instead of looping, a hung request
 * is aborted. Request counters prove each bound.
 */

let tokens: { accessToken: string; refreshToken: string } | null = { accessToken: "old", refreshToken: "r1" };
vi.mock("@/features/auth/token-store", () => ({
  getTokens: async () => tokens,
  setTokens: async (t: { accessToken: string; refreshToken: string }) => {
    tokens = { accessToken: t.accessToken, refreshToken: t.refreshToken };
  },
  clearTokens: async () => {
    tokens = null;
  },
}));
vi.mock("@/lib/config", () => ({ config: { apiUrl: "https://api.test" } }));

const json = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let calls: { url: string; auth: string | null }[];
function mockFetch(handler: (url: string, auth: string | null) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const auth = new Headers(init?.headers).get("Authorization");
    calls.push({ url: String(url), auth });
    return handler(String(url), auth);
  }));
}
const refreshes = () => calls.filter((c) => c.url.endsWith("/api/auth/mobile/refresh")).length;
const requests = (path: string) => calls.filter((c) => c.url.endsWith(path)).length;

beforeEach(() => {
  vi.resetModules();
  calls = [];
  tokens = { accessToken: "old", refreshToken: "r1" };
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the app's request client always terminates", () => {
  it("ten parallel 401s cause exactly one refresh, then each request retries once", { timeout: 5000 }, async () => {
    mockFetch((url, auth) => {
      if (url.endsWith("/refresh")) return json(200, { accessToken: "new", refreshToken: "r2", expiresIn: 900 });
      return auth === "Bearer new" ? json(200, { ok: true }) : json(401);
    });
    const { apiFetch } = await import("./client");
    const results = await Promise.all(Array.from({ length: 10 }, () => apiFetch("/api/x")));
    expect(results.every((r) => (r as { ok: boolean }).ok)).toBe(true);
    expect(refreshes()).toBe(1);
    expect(requests("/api/x")).toBe(20); // each: the 401, then one retry
  });

  it("a second 401 after a successful refresh stops: no refresh of a refresh, no third attempt", { timeout: 5000 }, async () => {
    mockFetch((url) => (url.endsWith("/refresh") ? json(200, { accessToken: "new", refreshToken: "r2", expiresIn: 900 }) : json(401)));
    const { apiFetch } = await import("./client");
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ name: expect.stringMatching(/Unauthorized/) });
    expect(refreshes()).toBe(1);
    expect(requests("/api/x")).toBe(2);
  });

  it("a refused refresh ends the session once and clears the tokens", { timeout: 5000 }, async () => {
    mockFetch((url) => (url.endsWith("/refresh") ? json(401) : json(401)));
    const { apiFetch, onSessionExpired } = await import("./client");
    const ended = vi.fn();
    onSessionExpired(ended);
    await expect(apiFetch("/api/x")).rejects.toBeDefined();
    expect(refreshes()).toBe(1);
    expect(requests("/api/x")).toBe(1);
    expect(tokens).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it("a refresh that gets no answer fails as a network error instead of retrying", { timeout: 5000 }, async () => {
    mockFetch((url) => {
      if (url.endsWith("/refresh")) throw new TypeError("network down");
      return json(401);
    });
    const { apiFetch } = await import("./client");
    await expect(apiFetch("/api/x")).rejects.toMatchObject({ name: expect.stringMatching(/Network/) });
    expect(refreshes()).toBe(1);
    expect(requests("/api/x")).toBe(1);
    expect(tokens).not.toBeNull(); // signal loss is not a sign-out
  });

  it("a request that never answers is aborted at its timeout", { timeout: 5000 }, async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const { apiFetch } = await import("./client");
    const pending = apiFetch("/api/slow", { timeoutMs: 1000 });
    const settled = expect(pending).rejects.toMatchObject({ name: expect.stringMatching(/Network/) });
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });
});

describe("the query retry rule is finite and classified", () => {
  it("never retries sign-outs or client errors; network errors at most 3 times; others twice", async () => {
    const { createQueryClient } = await import("@/lib/query/client");
    const { ApiError, NetworkError, UnauthorizedError } = await import("./errors");
    const retry = createQueryClient().getDefaultOptions().queries!.retry as (n: number, e: unknown) => boolean;
    const delay = createQueryClient().getDefaultOptions().queries!.retryDelay as (n: number) => number;
    const count = (e: unknown) => {
      let n = 0;
      while (retry(n, e)) {
        n++;
        if (n > 100) throw new Error("unbounded");
      }
      return n;
    };
    expect(count(new UnauthorizedError())).toBe(0);
    expect(count(new ApiError(404, null, {}))).toBe(0);
    expect(count(new NetworkError(new Error("x")))).toBe(3);
    expect(count(new ApiError(503, null, {}))).toBe(2);
    expect(delay(10)).toBe(8000); // backoff capped
  });
});
