import * as Location from "expo-location";
import { Platform } from "react-native";
import { num } from "@/lib/format";

/**
 * Where the phone is — asked for once, when the person asks for places
 * near them, and never tracked.
 *
 * One reading per request (no watch, no background), at "balanced"
 * accuracy, which is a few hundred metres and enough to sort places by
 * distance. The reading lives in the screen's memory: it is sent to the
 * nearby query and nowhere else, and is not stored on the phone or on
 * the server.
 *
 * Every way it can fail is a value, not an exception, so the screen can
 * say what happened and offer the alternative — choosing an area.
 */

export type Fix =
  | { ok: true; lat: number; lng: number; /** metres, when the OS says */ accuracy: number | null }
  | { ok: false; reason: "denied" | "blocked" | "services-off" | "unavailable" | "timeout" };



/**
 * Ask (if needed) and read. `blocked` means the system will not show the
 * prompt again — only the phone's settings can change it.
 */
export async function locate(timeoutMs = 12_000): Promise<Fix> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted" && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return { ok: false, reason: perm.canAskAgain ? "denied" : "blocked" };

    if (Platform.OS !== "web" && !(await Location.hasServicesEnabledAsync())) return { ok: false, reason: "services-off" };

    const reading = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs);
    if (reading === "timeout") {
      // A recent fix the OS already has is better than nothing — still a
      // real reading, just not a fresh one.
      const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }).catch(() => null);
      if (last) return { ok: true, lat: last.coords.latitude, lng: last.coords.longitude, accuracy: last.coords.accuracy ?? null };
      return { ok: false, reason: "timeout" };
    }
    return { ok: true, lat: reading.coords.latitude, lng: reading.coords.longitude, accuracy: reading.coords.accuracy ?? null };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** Worse than this, the screen says the location is approximate. */
export const ROUGH_ACCURACY_M = 1_000;

export function formatDistance(km: number, lang: "ar" | "en"): string {
  if (km < 1) {
    const m = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return lang === "ar" ? `${num(m, lang)} متر` : `${m} m`;
  }
  const v = km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
  return lang === "ar" ? `${num(v, lang)} كم` : `${v} km`;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([p, new Promise<"timeout">((r) => setTimeout(() => r("timeout"), ms))]);
}
