import * as Device from "expo-device";
import { Platform } from "react-native";
import { api } from "@/lib/api/client";
import type { AuthUser, LoginResponse } from "./roles";

/**
 * The auth endpoints, as the app calls them.
 *
 * Every sign-in route answers with the same LoginResponse — the server
 * builds it in one place (src/lib/auth/mobile-session.ts) whichever way
 * somebody proved who they are.
 */

function device() {
  return {
    deviceName: Device.deviceName ?? undefined,
    platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
  };
}

/** Owners and staff: email and password. */
export function loginWithPassword(email: string, password: string) {
  return api.post<LoginResponse>(
    "/api/auth/mobile/login",
    { email, password, ...device() },
    { anonymous: true },
  );
}

/**
 * Customers, step one: a code by WhatsApp. The website's own endpoint —
 * it holds no session, so the app can use it unchanged.
 */
export function requestPhoneCode(phone: string) {
  return api.post<{ sent: boolean }>("/api/auth/phone/send", { phone }, { anonymous: true });
}

/** Customers, step two. Creates the account on first sign-in, as the website does. */
export function loginWithPhoneCode(phone: string, code: string) {
  return api.post<LoginResponse>(
    "/api/auth/mobile/otp",
    { phone, code, ...device() },
    { anonymous: true },
  );
}

/** Who the stored tokens belong to — authoritative, unlike any cached copy. */
export function fetchMe() {
  return api.get<AuthUser>("/api/auth/mobile/me");
}

/** Drops the server-side session so the refresh token stops working. */
export function logout(refreshToken: string) {
  return api.post("/api/auth/mobile/logout", { refreshToken });
}
