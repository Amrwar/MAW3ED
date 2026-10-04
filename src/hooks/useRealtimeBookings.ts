"use client";

import { useEffect, useRef } from "react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";

export type RealtimeBookingEvent =
  | { type: "BOOKING_CREATED"; booking: DashboardBooking }
  | { type: "BOOKING_UPDATED"; id: string; status: string; customerName: string };

/**
 * Subscribes to /api/realtime/bookings (Server-Sent Events).
 *
 * The callback is called with typed events whenever a booking is created or
 * updated. The hook reconnects automatically on connection loss with
 * exponential back-off (2 s → 4 s → … → 30 s max).
 *
 * Usage:
 *   useRealtimeBookings((event) => {
 *     if (event.type === "BOOKING_UPDATED") { ... }
 *     if (event.type === "BOOKING_CREATED") { ... }
 *   });
 */
export function useRealtimeBookings(
  onEvent: (event: RealtimeBookingEvent) => void,
): void {
  // Keep a stable ref to the callback so reconnects don't require
  // re-subscribing. Writing it during render makes the component
  // non-idempotent, so the assignment lives in its own effect.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    // Guard against StrictMode double-invocation and cleanup after unmount
    let destroyed = false;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let retryDelay = 2000;

    function connect() {
      if (destroyed) return;

      es = new EventSource("/api/realtime/bookings");

      es.addEventListener("open", () => {
        retryDelay = 2000; // reset back-off on successful connection
      });

      es.addEventListener("BOOKING_CREATED", (raw) => {
        try {
          const booking = JSON.parse((raw as MessageEvent).data) as DashboardBooking;
          onEventRef.current({ type: "BOOKING_CREATED", booking });
        } catch {
          // malformed payload — ignore
        }
      });

      es.addEventListener("BOOKING_UPDATED", (raw) => {
        try {
          const { id, status, customerName } = JSON.parse((raw as MessageEvent).data) as {
            id: string;
            status: string;
            customerName: string;
          };
          onEventRef.current({ type: "BOOKING_UPDATED", id, status, customerName });
        } catch {
          // malformed payload — ignore
        }
      });

      es.addEventListener("error", () => {
        es?.close();
        es = null;
        if (!destroyed) {
          retryTimer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 30_000);
            connect();
          }, retryDelay);
        }
      });
    }

    connect();

    return () => {
      destroyed = true;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, []); // connect once on mount — callback changes are handled via ref
}
