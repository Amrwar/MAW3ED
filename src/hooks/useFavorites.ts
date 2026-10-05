"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Saved businesses, kept in the browser.
 *
 * Deliberately not on the account: a visitor should be able to save a
 * place before deciding whether to sign up, and nothing here is worth a
 * round trip. It lives on this device only, which the button's label
 * says out loud.
 *
 * Every read and write is wrapped — localStorage throws in a private
 * window and in some embedded browsers, and a saved list is not worth
 * taking the page down for.
 */

const KEY = "maw3ed:favorites";
/** Fires in this tab; the storage event only reaches the others. */
const CHANGED = "maw3ed:favorites-changed";

const EMPTY: string[] = [];

/**
 * useSyncExternalStore compares snapshots by identity, so parsing on
 * every call would loop forever. The last parse is cached against the
 * raw string it came from and only redone when that changes.
 */
let cachedRaw: string | null = null;
let cachedValue: string[] = EMPTY;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): string[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  if (!raw) {
    cachedValue = EMPTY;
    return cachedValue;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    cachedValue = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

/** The server has no storage; an empty list keeps hydration matching. */
function getServerSnapshot(): string[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Quota, or a store the browser has blocked. Nothing to recover.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const next = [...getSnapshot()];
    const at = next.indexOf(id);
    if (at === -1) next.push(id);
    else next.splice(at, 1);
    write(next);
  }, []);

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, isFavorite, toggle };
}
