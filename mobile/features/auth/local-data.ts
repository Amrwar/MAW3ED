import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * What a person left on the phone outside the secure store, forgotten
 * when they sign out or delete their account: booking drafts (the name,
 * phone and email typed into the form), unfinished payment pages, and
 * recent searches. Somebody handing their phone over should not hand
 * those over too.
 *
 * Kept: the language, the home city and other device settings, which
 * are not about the person.
 */
export const PERSONAL_PREFIXES = ["maw3ed.booking.", "maw3ed.pay.", "maw3ed.recentSearches"] as const;

export function isPersonalKey(key: string): boolean {
  return PERSONAL_PREFIXES.some((p) => key === p || key.startsWith(p));
}

export async function forgetLocalData(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(isPersonalKey);
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Best effort: signing out never fails because storage did.
  }
}
