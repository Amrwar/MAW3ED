import { ApiError, NetworkError, UnauthorizedError } from "./errors";
import { getTokens, setTokens, clearTokens } from "@/features/auth/token-store";
import { config } from "@/lib/config";

/**
 * The one way the app talks to Maw3ed.
 *
 * It exists so three things happen in exactly one place: the access
 * token is attached, an expired one is refreshed and the request
 * retried, and a failure becomes a typed error instead of a shape the
 * caller has to guess at.
 *
 * The server's contract, read from the existing routes rather than
 * assumed: a success returns the payload directly (82 of 82 routes —
 * none wraps it in `data`), and a failure returns `{ error: string }`
 * with an Arabic message already written for a person. So the error
 * carries that message and the screen can show it without inventing
 * its own wording.
 */

/** Validated in lib/config.ts: a build without one never gets this far. */
const BASE_URL = config.apiUrl;

/**
 * Told when the session ends underneath the app — the refresh token was
 * refused, so the tokens are gone. The auth provider listens, so a 401
 * in any query signs the person out in one place rather than each
 * screen discovering it separately.
 */
type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

export function onSessionExpired(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/** A refresh in flight, so ten parallel 401s cause one refresh, not ten. */
let refreshInFlight: Promise<boolean> | null = null;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the token entirely. For login and other public endpoints. */
  anonymous?: boolean;
  /** Internal: stops a retried request retrying forever. */
  _retried?: boolean;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, anonymous, _retried, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (body !== undefined) headers.set("Content-Type", "application/json");

  if (!anonymous) {
    const tokens = await getTokens();
    if (tokens?.accessToken) headers.set("Authorization", `Bearer ${tokens.accessToken}`);
  }

  // A phone loses signal mid-request and fetch will wait forever.
  // Without this the UI sits on a spinner with no way out.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // A caller's own signal still cancels — TanStack Query aborts a search
  // the person has already typed past.
  const outer = init.signal;
  const onOuterAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    // No response at all: aeroplane mode, dead wifi, DNS, a timeout.
    // Distinct from a server error because the app can offer "retry"
    // for one and not the other.
    throw new NetworkError(cause);
  } finally {
    clearTimeout(timer);
  }

  // ── Expired access token ────────────────────────────────────────────
  //
  // One retry, once. A second 401 after a successful refresh means the
  // session is genuinely over, not that the token was stale.
  if (response.status === 401 && !anonymous && !_retried) {
    const hadSession = (await getTokens()) !== null;
    const refreshed = hadSession && (await refreshOnce());
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    await clearTokens();
    // Only when a session actually ended. Somebody who was never signed
    // in has nothing to end, and announcing it would clear the cache on
    // every anonymous 401.
    if (hadSession) for (const listener of sessionListeners) listener();
    throw new UnauthorizedError();
  }

  if (response.status === 204) {
    outer?.removeEventListener("abort", onOuterAbort);
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);
  outer?.removeEventListener("abort", onOuterAbort);
  // Cancelled while the body was still arriving: the null above is not
  // an empty answer, and must not be handed back as one.
  if (controller.signal.aborted) throw new NetworkError(new Error("aborted"));

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : null;
    if (response.status === 401) throw new UnauthorizedError(message ?? undefined);
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

/**
 * Trade the refresh token for a new pair.
 *
 * Shared between concurrent callers: a screen with four queries that
 * all 401 at once should cause one refresh, not four — four would race,
 * and three of them would present a refresh token the first had already
 * rotated.
 */
function refreshOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens?.refreshToken) return false;

      const res = await fetch(`${BASE_URL}/api/auth/mobile/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) return false;

      const next = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };
      await setTokens(next);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE", body }),
};

export { BASE_URL };
