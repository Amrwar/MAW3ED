import * as SecureStoreNative from "expo-secure-store";
import { Platform } from "react-native";
import { config } from "@/lib/config";
import type { AuthUser } from "./roles";

/**
 * Where the tokens live.
 *
 * expo-secure-store, which is the Keychain on iOS and EncryptedSharedPreferences
 * on Android — not AsyncStorage, which is a plain file any process with
 * the device's storage can read, and not module state, which dies with
 * the app.
 *
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY on iOS: the tokens are not readable
 * while the phone is locked, and they are excluded from iCloud backups,
 * so restoring a backup onto a different phone does not carry somebody
 * else's session with it.
 */

const ACCESS_KEY = "maw3ed.access";
const REFRESH_KEY = "maw3ed.refresh";
const EXPIRY_KEY = "maw3ed.expiresAt";
/**
 * The account last confirmed by the server, so a cold start without a
 * connection still shows who is signed in (features/auth/restore.ts).
 * Never trusted for anything: the server checks every request.
 */
const LAST_USER_KEY = "maw3ed.lastUser";

/**
 * The browser preview only. A browser has no Keychain or Keystore, so
 * expo-secure-store does nothing there and nobody could sign in to try
 * the app on a laptop. Outside production, the web build keeps tokens
 * in sessionStorage — gone when the tab closes. iOS and Android always
 * use the secure store above; a production web build never stores
 * tokens at all.
 */
const previewStore = {
  getItemAsync: async (k: string) => globalThis.sessionStorage?.getItem(k) ?? null,
  setItemAsync: async (k: string, v: string) => globalThis.sessionStorage?.setItem(k, v),
  deleteItemAsync: async (k: string) => globalThis.sessionStorage?.removeItem(k),
};

const SecureStore =
  Platform.OS === "web" && config.appEnv !== "production"
    ? { ...SecureStoreNative, ...previewStore }
    : SecureStoreNative;

const OPTIONS: SecureStoreNative.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Writes and deletes run one at a time, in the order they were asked for.
 * Otherwise a sign-out's deletes and a new sign-in's writes, a moment
 * apart, could interleave and leave half of each.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op);
  queue = run.catch(() => undefined);
  return run;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms. Derived from the server's expiresIn at the time of issue. */
  expiresAt: number;
}

export async function getTokens(): Promise<Tokens | null> {
  try {
    const [accessToken, refreshToken, expiresAt] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY, OPTIONS),
      SecureStore.getItemAsync(REFRESH_KEY, OPTIONS),
      SecureStore.getItemAsync(EXPIRY_KEY, OPTIONS),
    ]);
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken, expiresAt: Number(expiresAt ?? 0) };
  } catch {
    // A device that cannot read its own keychain is signed out rather
    // than crashed. It happens: a restore, a locked device at launch.
    return null;
  }
}

export async function setTokens(input: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}): Promise<void> {
  const expiresAt = Date.now() + input.expiresIn * 1000;
  await serial(() =>
    Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, input.accessToken, OPTIONS),
      SecureStore.setItemAsync(REFRESH_KEY, input.refreshToken, OPTIONS),
      SecureStore.setItemAsync(EXPIRY_KEY, String(expiresAt), OPTIONS),
    ]),
  );
}

export async function clearTokens(): Promise<void> {
  await serial(() =>
    Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, OPTIONS),
      SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
      SecureStore.deleteItemAsync(EXPIRY_KEY, OPTIONS),
      SecureStore.deleteItemAsync(LAST_USER_KEY, OPTIONS),
    ]),
  );
}

export async function rememberUser(user: AuthUser): Promise<void> {
  await serial(() => SecureStore.setItemAsync(LAST_USER_KEY, JSON.stringify(user), OPTIONS));
}

export async function lastUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(LAST_USER_KEY, OPTIONS);
    const u = raw ? (JSON.parse(raw) as AuthUser) : null;
    return u && typeof u.id === "string" ? u : null;
  } catch {
    return null;
  }
}
