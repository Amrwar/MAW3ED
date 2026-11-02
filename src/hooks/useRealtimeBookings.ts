"use client";

import { useEffect, useRef } from "react";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";
import { bookingStream } from "@/lib/realtime/booking-stream";

export type RealtimeBookingEvent =
  | { type: "BOOKING_CREATED"; booking: DashboardBooking; replayed: boolean }
  | { type: "BOOKING_UPDATED"; id: string; status: string; customerName: string; replayed: boolean }
  /** The stream could not resume where it stopped: reload the list. */
  | { type: "BOOKINGS_RESYNC" };

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
        // A change from before this page's connection: shown, not announced.
        const replayed = e.payload.replayed === true;
        if (e.type === "BOOKINGS_RESYNC") {
          onEventRef.current({ type: "BOOKINGS_RESYNC" });
        } else if (e.type === "BOOKING_CREATED") {
          onEventRef.current({ type: "BOOKING_CREATED", booking: e.payload as DashboardBooking, replayed });
        } else {
          // The stream delivers objects only (null and arrays are dropped there).
          const { id, status, customerName } = e.payload as { id: string; status: string; customerName: string };
          onEventRef.current({ type: "BOOKING_UPDATED", id, status, customerName, replayed });
        }
      }),
    [], // subscribe once on mount; the returned function unsubscribes
  );
}
