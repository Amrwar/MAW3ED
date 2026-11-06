"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in step with the window.
 *
 * False on the server and through hydration (there is no window to
 * ask), then the real answer: a component that renders differently on
 * a phone draws its wide form first and settles a commit later, rather
 * than mismatching the server's HTML. A null query subscribes to
 * nothing and answers false.
 */
export function useMediaQuery(query: string | null): boolean {
  // One MediaQueryList per query, not one per render.
  const list = useMemo(
    () => (query && typeof window !== "undefined" ? window.matchMedia(query) : null),
    [query],
  );
  const subscribe = useCallback(
    (onChange: () => void) => {
      list?.addEventListener("change", onChange);
      return () => list?.removeEventListener("change", onChange);
    },
    [list],
  );
  return useSyncExternalStore(
    subscribe,
    () => list?.matches ?? false,
    () => false,
  );
}
