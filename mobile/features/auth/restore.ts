import { UnauthorizedError } from "@/lib/api/errors";
import type { AuthUser } from "./roles";

/**
 * Cold start: who is signed in on this phone.
 *
 * The server's answer is authoritative — a user cached on the device
 * could name a role the account no longer has. But only a server that
 * actually answered "this session is over" signs anybody out. No signal,
 * a timeout or a server error is not an answer: the tokens stay, the
 * last account this phone knew is shown (`verified: false`), and the app
 * asks again once it is back online (AuthProvider). Opening the app in a
 * basement must not throw away a valid sign-in.
 */

export interface RestoreDeps {
  hasTokens: () => Promise<boolean>;
  fetchMe: () => Promise<AuthUser>;
  clearTokens: () => Promise<void>;
  lastUser: () => Promise<AuthUser | null>;
  rememberUser: (u: AuthUser) => Promise<void>;
}

export interface Restored {
  user: AuthUser | null;
  /** False when the server could not be asked: shown from the phone's memory. */
  verified: boolean;
}

export async function restoreSession(d: RestoreDeps): Promise<Restored> {
  if (!(await d.hasTokens())) return { user: null, verified: true };
  try {
    const me = await d.fetchMe();
    await d.rememberUser(me).catch(() => undefined);
    return { user: me, verified: true };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      // Expired or revoked: simply somebody who is not signed in any more.
      await d.clearTokens();
      return { user: null, verified: true };
    }
    return { user: await d.lastUser().catch(() => null), verified: false };
  }
}

/** After a failed re-check that was not a refusal: ask again after these waits, then only when the connection returns. */
export const RECHECK_MS = [5_000, 30_000, 120_000] as const;

export interface RecheckDeps {
  fetchMe: () => Promise<AuthUser>;
  clearTokens: () => Promise<void>;
  rememberUser: (u: AuthUser) => Promise<void>;
  isOnline: () => boolean;
  /** Calls back whenever the connection changes; answers how to stop. */
  onConnectionChange: (fn: () => void) => () => void;
  /** True once who is signed in has changed since the check began: its answer is dropped. */
  isStale: () => boolean;
  /** The server confirmed the account. */
  confirmed: (u: AuthUser) => void;
  /** The server refused the session: tokens cleared. */
  signedOut: () => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
}

/**
 * After a launch shown from the phone's memory (`verified: false`): asks
 * the server again — now if online, whenever the connection comes back,
 * and after each failure that was not a refusal, RECHECK_MS apart, a
 * bounded number of times. Answers how to stop.
 */
export function recheckSession(d: RecheckDeps): () => void {
  const setTimer = d.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = d.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  let busy = false;
  let stopped = false;
  let tries = 0;
  let timer: unknown;
  const stale = () => stopped || d.isStale();
  const check = () => {
    if (busy || stale() || !d.isOnline()) return;
    busy = true;
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    d.fetchMe()
      .then(
        async (me) => {
          if (stale()) return;
          d.confirmed(me);
          // Asked before any sign-out that follows, so the store's order
          // (token-store.ts) lets that sign-out remove it.
          await d.rememberUser(me).catch(() => undefined);
        },
        async (e) => {
          if (stale()) return;
          if (e instanceof UnauthorizedError) {
            // Ordered before any sign-in that follows (token-store.ts), so
            // it never removes the next account's tokens.
            await d.clearTokens().catch(() => undefined);
            if (!stale()) d.signedOut();
            return;
          }
          const wait = RECHECK_MS[tries++];
          if (wait !== undefined) timer = setTimer(check, wait);
        },
      )
      .catch(() => undefined)
      .finally(() => {
        busy = false;
      });
  };
  check();
  const unsubscribe = d.onConnectionChange(check);
  return () => {
    stopped = true;
    if (timer !== undefined) clearTimer(timer);
    unsubscribe();
  };
}
