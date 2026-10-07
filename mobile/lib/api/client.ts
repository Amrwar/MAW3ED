import Constants from "expo-constants";
import { ApiError, NetworkError, UnauthorizedError } from "./errors";
import { getTokens, setTokens, clearTokens } from "@/services/auth/token-store";

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

const BASE_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "";

if (!BASE_URL) {
  // Loud on purpose. An app pointed at nowhere fails on every screen
  // with a different confusing symptom; this names the cause once.
  console.warn("[api] no apiUrl in expo config — every request will fail");
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
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
    await clearTokens();
    throw new UnauthorizedError();
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

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
