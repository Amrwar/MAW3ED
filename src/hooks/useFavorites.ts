"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";

/**
 * Saved businesses.
 *
 * Two homes, one list. A signed-out visitor saves to this device, which
 * is what lets somebody save a place before deciding whether to sign
 * up. A signed-in customer saves to their account, so the list follows
 * them to a new phone.
 *
 * The device list is handed over once on sign-in and then left alone —
 * clearing it would lose the list for anyone who signs out again, and
 * merging is idempotent so a repeat does nothing.
 *
 * Every read and write is wrapped: localStorage throws in a private
 * window and in some embedded browsers, and a saved list is not worth
 * taking the page down for.
 */

const KEY = "maw3ed:favorites";
/** Fires in this tab; the storage event only reaches the others. */
const CHANGED = "maw3ed:favorites-changed";
const EMPTY: string[] = [];

/* ─── The local store ────────────────────────────────────── */

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

/* ─── The hook ───────────────────────────────────────────── */

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const syncedFor = useRef<string | null>(null);

  // On sign-in, hand the device list over and adopt the account's.
  // Keyed on the session status so it runs once per sign-in, not once
  // per render.
  useEffect(() => {
    if (!signedIn || syncedFor.current === "done") return;
    syncedFor.current = "done";

    let cancelled = false;

    (async () => {
      try {
        const local = getSnapshot();
        const res = await fetch("/api/account/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessIds: local }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { businessIds?: string[] };
        if (data.businessIds && !cancelled) write(data.businessIds);
      } catch {
        // Offline, or the endpoint is unhappy. The device list still
        // works; the next sign-in will try again.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const toggle = useCallback(
    (id: string) => {
      const current = getSnapshot();
      const saved = current.includes(id);
      const next = saved ? current.filter((x) => x !== id) : [...current, id];

      // Write locally first so the heart responds immediately; the
      // request catches up. A failed request leaves the two out of
      // step until the next sign-in merge, which is the right trade
      // for a button pressed this often.
      write(next);

      if (!signedIn) return;

      void fetch(
        saved ? `/api/account/favorites?businessId=${encodeURIComponent(id)}` : "/api/account/favorites",
        saved
          ? { method: "DELETE" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId: id }),
            },
      ).catch(() => {});
    },
    [signedIn],
  );

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, isFavorite, toggle, signedIn };
}
