import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Searches somebody ran, on this device only — never sent anywhere.
 * Saved when a search is submitted or a result is opened from it, not
 * on every keystroke, so half-typed words never appear.
 */

const KEY = "maw3ed.recentSearches";
export const MAX_RECENT = 8;

/** The list with `term` at the front, once, ignoring case and spacing. */
export function pushRecent(list: string[], term: string): string[] {
  const t = term.trim().replace(/\s+/g, " ");
  if (t.length < 2) return list;
  const same = (x: string) => x.toLocaleLowerCase() === t.toLocaleLowerCase();
  return [t, ...list.filter((x) => !same(x))].slice(0, MAX_RECENT);
}

export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);
  // Until the stored list has been read, writing would replace it.
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const stored = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
        // Anything searched before this resolved is newer than what was
        // stored: laid on top of it, never in place of it.
        loaded.current = true;
        setRecent((sinceStart) => {
          const merged = [...sinceStart].reverse().reduce(pushRecent, stored.slice(0, MAX_RECENT));
          if (sinceStart.length > 0) AsyncStorage.setItem(KEY, JSON.stringify(merged)).catch(() => undefined);
          return merged;
        });
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  const save = useCallback((next: string[]) => {
    setRecent(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  return {
    recent,
    add: useCallback((term: string) => setRecent((list) => {
      const next = pushRecent(list, term);
      if (next !== list && loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    }), []),
    remove: useCallback((term: string) => save(recent.filter((x) => x !== term)), [recent, save]),
    clear: useCallback(() => save([]), [save]),
  };
}
