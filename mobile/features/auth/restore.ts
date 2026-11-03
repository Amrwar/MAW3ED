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
