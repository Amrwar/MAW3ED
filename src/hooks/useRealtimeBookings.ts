"use client";

import { useEffect, useRef } from "react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";
import { bookingStream } from "@/lib/realtime/booking-stream";

export type RealtimeBookingEvent =
  | { type: "BOOKING_CREATED"; booking: DashboardBooking }
  | { type: "BOOKING_UPDATED"; id: string; status: string; customerName: string };

/**
 * Subscribes to /api/realtime/bookings (Server-Sent Events).
 *
 * The callback is called with typed events whenever a booking is created or
 * updated. Every component in the tab shares one connection, and
 * reconnection is bounded — see lib/realtime/booking-stream.ts.
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
  // Keep a stable ref to the callback so a new callback each render does
  // not re-subscribe. Written in its own effect, not during render.
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(
    () =>
      bookingStream().subscribe((e) => {
        if (e.type === "BOOKING_CREATED") {
          onEventRef.current({ type: "BOOKING_CREATED", booking: e.payload as DashboardBooking });
        } else {
          // The stream delivers objects only (null and arrays are dropped there).
          const { id, status, customerName } = e.payload as { id: string; status: string; customerName: string };
          onEventRef.current({ type: "BOOKING_UPDATED", id, status, customerName });
        }
      }),
    [], // subscribe once on mount; the returned function unsubscribes
  );
}
