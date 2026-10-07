import * as SecureStore from "expo-secure-store";

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

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

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
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, input.accessToken, OPTIONS),
    SecureStore.setItemAsync(REFRESH_KEY, input.refreshToken, OPTIONS),
    SecureStore.setItemAsync(EXPIRY_KEY, String(expiresAt), OPTIONS),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY, OPTIONS),
    SecureStore.deleteItemAsync(REFRESH_KEY, OPTIONS),
    SecureStore.deleteItemAsync(EXPIRY_KEY, OPTIONS),
  ]);
}
