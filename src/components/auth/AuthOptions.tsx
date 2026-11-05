"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Which sign-in methods this deployment offers, decided on the server.
 *
 * The (auth) layout reads the environment and passes the answer down,
 * so the Google button is in the first HTML or not at all: no request
 * to /api/auth/providers after load, and nothing jumps into place.
 */
export interface AuthOptions {
  google: boolean;
}

const AuthOptionsContext = createContext<AuthOptions>({ google: false });

export function AuthOptionsProvider({ value, children }: { value: AuthOptions; children: ReactNode }) {
  return <AuthOptionsContext.Provider value={value}>{children}</AuthOptionsContext.Provider>;
}

export function useAuthOptions(): AuthOptions {
  return useContext(AuthOptionsContext);
}
