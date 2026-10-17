"use client";

import { useEffect, useState } from "react";

/**
 * The current time, refreshed every minute.
 *
 * For anything that depends on the clock — which booking moves are open
 * yet (lib/bookings/progress-guard) — so a page left open does not keep
 * the buttons it had when it loaded. The server checks again on every
 * PATCH; this only keeps the screen in step with it.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
