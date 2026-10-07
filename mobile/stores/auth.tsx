import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/lib/api/client";
import { clearTokens, getTokens, setTokens } from "@/services/auth/token-store";
import type { AppRole, AuthUser, LoginResponse } from "@/types/auth";
import { primaryRole, rolesFor } from "@/types/auth";

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
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  // Cold start: if there are tokens, ask the server who they belong to.
  // The answer is authoritative — a user object cached on the device
  // could name a role the account no longer has.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tokens = await getTokens();
        if (!tokens) return;
        const me = await api.get<AuthUser>("/api/account/profile");
        if (!cancelled) setUser(me);
      } catch {
        // Expired or revoked. Not an error worth showing: it is simply
        // somebody who is not signed in any more.
        await clearTokens();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<LoginResponse>(
      "/api/auth/mobile/login",
      {
        email,
        password,
        deviceName: Device.deviceName ?? undefined,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
      { anonymous: true },
    );
    await setTokens(result);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    const tokens = await getTokens();
    try {
      if (tokens?.refreshToken) {
        // Tells the server to drop the session so the refresh token
        // stops working on this device even though its signature is
        // still valid.
        await api.post("/api/auth/mobile/logout", { refreshToken: tokens.refreshToken });
      }
    } catch {
      // The local sign-out happens regardless. Somebody handing their
      // phone over should not stay signed in because the network was
      // down at that moment.
    } finally {
      await clearTokens();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      restoring,
      roles: rolesFor(user),
      role: primaryRole(user),
      signIn,
      signOut,
    }),
    [user, restoring, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
