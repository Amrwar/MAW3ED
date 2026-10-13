import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { api } from "@/lib/api/client";
import { config } from "@/lib/config";

/**
 * Push, from the app's side: permission, the device's token, and telling
 * the server about it.
 *
 * The token registered is an Expo push token. The server stores it in
 * DeviceToken through POST /api/mobile/devices, which already exists;
 * what does not exist yet is the server sending to it — the PUSH channel
 * in src/lib/notifications/channels.ts is declared but has no sender.
 * When it gets one, it posts to Expo's push service with these tokens
 * and nothing here changes.
 *
 * Permission is never asked for on launch. It is asked when the person
 * turns notifications on, which is when they know what it is for; a
 * cold prompt on first launch is the one most people refuse, and iOS
 * does not ask twice.
 */

export type PushStatus =
  | "registered"
  | "denied"
  | "undetermined"
  /** Simulator, emulator or web: there is no push token to get. */
  | "unsupported"
  /** No EAS project yet (`eas init`), so no Expo push token can be issued. */
  | "not-configured";

const TOKEN_KEY = "maw3ed.pushToken";

/** Show a notification even while the app is open, as both platforms do for chat apps. */
export function configureForegroundHandling() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  // Android 8+ shows nothing without a channel. One for now: bookings
  // are the only thing the server will push.
  await Notifications.setNotificationChannelAsync("default", {
    name: "الحجوزات",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Where things stand, without prompting. */
export async function pushStatus(): Promise<PushStatus> {
  if (!Device.isDevice) return "unsupported";
  if (!config.easProjectId) return "not-configured";
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "denied") return "denied";
  if (status !== "granted") return "undetermined";
  return (await AsyncStorage.getItem(TOKEN_KEY)) ? "registered" : "undetermined";
}

/**
 * Register this device. `prompt` asks for permission if it has not been
 * decided; without it, only an already-granted permission is used —
 * which is what runs silently after sign-in.
 */
export async function registerForPush({ prompt }: { prompt: boolean }): Promise<PushStatus> {
  if (!Device.isDevice) return "unsupported";
  if (!config.easProjectId) return "not-configured";

  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && prompt) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status === "denied") return "denied";
  if (status !== "granted") return "undetermined";

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId });
  await api.post("/api/mobile/devices", {
    token,
    platform: Platform.OS === "ios" ? "ios" : "android",
  });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return "registered";
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
    // The server drops tokens that stop working; nothing to do here.
  } finally {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** The website path a notification points at, if the server attached one. */
export function hrefOf(response: Notifications.NotificationResponse): string | null {
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const href = data?.href ?? data?.url;
  return typeof href === "string" ? href : null;
}
