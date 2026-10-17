import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { api } from "@/lib/api/client";
import { config } from "@/lib/config";

/**
 * Push, from the app's side: permission, the device's token, telling the
 * server about it, and where a tapped notification goes.
 *
 * The token is an Expo push token. The server stores it in DeviceToken
 * (POST /api/mobile/devices) and sends through Expo's push service, which
 * holds the APNs and FCM credentials (src/lib/services/expo-push.ts).
 *
 * Permission is never asked for on launch — only when the person turns
 * notifications on, when they know what it is for. A cold prompt on
 * first launch is the one most people refuse, and iOS does not ask twice.
 *
 * The person's choice is the device: "push on this device" off removes
 * the registration and remembers not to add it back silently; signing
 * out removes it too, so the next person on a shared phone does not get
 * the previous one's bookings.
 */

export type PushStatus =
  | "registered"
  | "denied"
  | "undetermined"
  /** Turned off in the app by the person, while the OS still allows it. */
  | "off"
  /** Simulator, emulator or web: there is no push token to get. */
  | "unsupported"
  /** No EAS project yet (`eas init`), so no Expo push token can be issued. */
  | "not-configured";

const TOKEN_KEY = "maw3ed.pushToken";
const OPT_OUT_KEY = "maw3ed.pushOff";

/** Show a notification even while the app is open, as both platforms do for chat apps. */
export function configureForegroundHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Android 8+ shows nothing without a channel. "default" is the id the
  // server sends with every push.
  // Named in the app's language (as last chosen) — the name shows in the
  // system's notification settings. Re-set on every registration, so a
  // change of language renames it the next time the app registers.
  const lang = (await AsyncStorage.getItem("maw3ed.lang").catch(() => null)) === "en" ? "en" : "ar";
  await Notifications.setNotificationChannelAsync("default", {
    name: lang === "ar" ? "الحجوزات" : "Bookings",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Where things stand, without prompting. */
export async function pushStatus(): Promise<PushStatus> {
  // expo-device reports a browser as a device; the browser preview has no push.
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  if (!config.easProjectId) return "not-configured";
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "denied") return "denied";
  if (status !== "granted") return "undetermined";
  if ((await AsyncStorage.getItem(OPT_OUT_KEY)) === "1") return "off";
  return (await AsyncStorage.getItem(TOKEN_KEY)) ? "registered" : "undetermined";
}

/**
 * Register this device. `prompt` is the person asking for notifications:
 * it may show the system prompt, and it lifts an earlier in-app "off".
 * Without it — the silent refresh after sign-in and on every launch —
 * only an already-granted permission is used, and "off" is respected.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<PushStatus> {
  if (Platform.OS === "web" || !Device.isDevice) return "unsupported";
  if (!config.easProjectId) return "not-configured";
  if (!prompt && (await AsyncStorage.getItem(OPT_OUT_KEY)) === "1") return "off";

  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && prompt) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status === "denied") return "denied";
  if (status !== "granted") return "undetermined";

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });
  await sendToken(token);
  await AsyncStorage.removeItem(OPT_OUT_KEY);
  return "registered";
}

async function sendToken(token: string) {
  await api.post("/api/mobile/devices", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

/**
 * The person turned push off for this device. The registration goes, and
 * it stays gone until they turn it back on — the silent re-register on
 * launch does not undo their choice.
 */
export async function turnPushOff(): Promise<void> {
  await AsyncStorage.setItem(OPT_OUT_KEY, "1");
  await unregisterPush();
}

/**
 * Tokens rotate — a restore from backup, an OS update, FCM deciding so.
 * When the platform hands the app a new one, the server is told, unless
 * the person has turned push off. Returns the unsubscribe.
 */
export function watchTokenChanges(): () => void {
  if (Platform.OS === "web" || !Device.isDevice || !config.easProjectId) return () => undefined;
  const sub = Notifications.addPushTokenListener(async () => {
    try {
      if ((await AsyncStorage.getItem(OPT_OUT_KEY)) === "1") return;
      // The listener gives the native device token; the server needs the
      // Expo token, which is derived from it.
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId as string });
      if (data !== (await AsyncStorage.getItem(TOKEN_KEY))) await sendToken(data);
    } catch {
      // Picked up on the next launch's silent registration instead.
    }
  });
  return () => sub.remove();
}

/**
 * Forget this device, before signing out — otherwise the next person to
 * sign in on this phone receives the previous one's booking alerts.
 * Best effort: signing out must not wait on the network.
 */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await api.delete("/api/mobile/devices", { token });
  } catch {
    // The server disables tokens that stop working; nothing to do here.
  } finally {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** What a tapped notification carries: where to go, and the booking it is about. */
export interface PushTarget {
  /** A website path, translated by lib/links like any maw3ed.net link. */
  path: string | null;
  /** A customer's booking, opened through GET /api/account/bookings/[id]. */
  bookingId: string | null;
}

export function targetOf(response: Notifications.NotificationResponse): PushTarget {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const pick = (k: string) => (typeof data?.[k] === "string" ? (data[k] as string) : null);
  return { path: pick("path") ?? pick("href") ?? pick("url"), bookingId: pick("bookingId") };
}

/** The booking's own screen, when it is this account's; null to fall back to the path. */
export async function bookingTokenFor(bookingId: string): Promise<string | null> {
  try {
    const { accessToken } = await api.get<{ accessToken: string }>(`/api/account/bookings/${encodeURIComponent(bookingId)}`);
    return accessToken;
  } catch {
    return null;
  }
}

/**
 * The same booking on the business side: the id when this person may
 * open it there (owner, or staff whose scope includes it), else null.
 * The server decides; a 404 or 403 is simply "not yours".
 */
export async function businessBookingFor(bookingId: string): Promise<string | null> {
  try {
    const b = await api.get<{ id: string }>(`/api/business/bookings/${encodeURIComponent(bookingId)}`);
    return b.id;
  } catch {
    return null;
  }
}
