import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { UnauthorizedError } from "@/lib/api/errors";
import { onSessionExpired } from "@/lib/api/client";
import { track } from "@/lib/analytics";
import { registerForPush, unregisterPush } from "@/features/notifications/push";
import { clearTokens, getTokens, lastUser, rememberUser, setTokens } from "./token-store";
import { restoreSession } from "./restore";
import { forgetLocalData } from "./local-data";
import { fetchMe, loginWithPassword, loginWithPhoneCode, logout, requestPhoneCode } from "./api";
import type { AppRole, AuthUser, LoginResponse } from "./roles";
import { primaryRole, rolesFor } from "./roles";

/**
 * Who is signed in, for the whole app.
 *
 * Context rather than a global store library: the state is small — a
 * user and a loading flag — and everything that changes often is server
 * state, which belongs to TanStack Query. Reaching for a store library
 * to hold two fields is how an app ends up with two sources of truth.
 *
 * `restoring` exists so the navigator can tell "not signed in" from
 * "we have not looked yet". Without it the app shows the login screen
 * for a frame on every cold start, to people who are signed in.
 */

interface AuthState {
  user: AuthUser | null;
  restoring: boolean;
  roles: AppRole[];
  role: AppRole;
  /** Owners and staff. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Customers, step one: the code arrives by WhatsApp. */
  requestCode: (phone: string) => Promise<void>;
  /** Customers, step two. Answers who signed in, so a new account can be asked its name. */
  signInWithCode: (phone: string, code: string) => Promise<AuthUser>;
  /** After the profile is edited: the name and email the app shows, without a round trip. */
  updateUser: (patch: Partial<Pick<AuthUser, "name" | "email">>) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  // Shown from the phone's memory because the server could not be asked
  // at launch; asked again as soon as the app is back online.
  const [unverified, setUnverified] = useState(false);

  // Cold start: if there are tokens, ask the server who they belong to.
  // Only an answer "this session is over" signs out; no signal keeps the
  // sign-in (features/auth/restore.ts).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await restoreSession({
          hasTokens: async () => !!(await getTokens()),
          fetchMe,
          clearTokens,
          lastUser,
          rememberUser,
        });
        if (!cancelled) {
          setUser(r.user);
          setUnverified(!r.verified);
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Back online after a launch without a connection: the server's answer,
  // once. A refused session signs out; another failure waits for the next
  // time the connection comes back.
  useEffect(() => {
    if (!unverified) return;
    let busy = false;
    const check = () => {
      if (busy || !onlineManager.isOnline()) return;
      busy = true;
      fetchMe()
        .then(async (me) => {
          setUser(me);
          setUnverified(false);
          await rememberUser(me).catch(() => undefined);
        })
        .catch(async (e) => {
          if (e instanceof UnauthorizedError) {
            await clearTokens();
            setUser(null);
            setUnverified(false);
          }
        })
        .finally(() => {
          busy = false;
        });
    };
    check();
    return onlineManager.subscribe(check);
  }, [unverified]);

  // The session can end underneath the app — a refresh token revoked on
  // the web, or simply expired. The API client says so once; this is
  // where it turns into "signed out", whichever screen noticed.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        queryClient.clear();
        track("session_expired");
      }),
    [queryClient],
  );

  // Once signed in, use push if it has already been allowed. Never
  // prompts here — see features/notifications/push.ts.
  useEffect(() => {
    if (user) registerForPush({ prompt: false }).catch(() => undefined);
  }, [user]);

  const accept = useCallback(
    async (result: LoginResponse, method: "password" | "phone") => {
      await setTokens(result);
      await rememberUser(result.user).catch(() => undefined);
      // Whatever the last account cached is not this account's.
      queryClient.clear();
      setUser(result.user);
      setUnverified(false);
      track("signed_in", { method, role: primaryRole(result.user) });
      return result.user;
    },
    [queryClient],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      await accept(await loginWithPassword(email, password), "password");
    },
    [accept],
  );

  const requestCode = useCallback(async (phone: string) => {
    await requestPhoneCode(phone);
  }, []);

  const signInWithCode = useCallback(
    async (phone: string, code: string) => accept(await loginWithPhoneCode(phone, code), "phone"),
    [accept],
  );

  const updateUser = useCallback((patch: Partial<Pick<AuthUser, "name" | "email">>) => {
    setUser((u) => {
      const next = u ? { ...u, ...patch } : u;
      if (next) void rememberUser(next).catch(() => undefined);
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    // Before the tokens go: forgetting the device needs them.
    await unregisterPush();
    const tokens = await getTokens();
    try {
      // Drops the server-side session so the refresh token stops
      // working even though its signature is still valid.
      if (tokens?.refreshToken) await logout(tokens.refreshToken);
    } catch {
      // The local sign-out happens regardless. Somebody handing their
      // phone over should not stay signed in because the network was
      // down at that moment.
    } finally {
      await clearTokens();
      // What this person typed or started on the phone goes with them:
      // booking drafts (name, phone), unfinished payments, searches.
      await forgetLocalData();
      queryClient.clear();
      setUser(null);
      setUnverified(false);
      track("signed_out");
    }
  }, [queryClient]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      restoring,
      roles: rolesFor(user),
      role: primaryRole(user),
      signIn,
      requestCode,
      signInWithCode,
      updateUser,
      signOut,
    }),
    [user, restoring, signIn, requestCode, signInWithCode, updateUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
