import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { CreateBookingResponse, PublicBooking, Quote, SlotsResponse } from "@/types/api";
import type { BookingRequest } from "./flow";
import { shouldPoll } from "./outcome";

/**
 * The booking flow's conversations with the server. Every one of them
 * goes to the endpoint the website's widget uses — the app adds no
 * booking logic of its own.
 *
 * All anonymous: booking is a public endpoint (a customer without an
 * account books on the website too), and an expired session must not
 * stop somebody from seeing times or holding one.
 */

export type SlotQuery = {
  serviceId: string;
  date: string;
  staffMemberId?: string | null;
  resourceId?: string | null;
  branchId?: string | null;
};

export function useSlots(slug: string, q: SlotQuery | null) {
  return useQuery({
    enabled: q !== null,
    queryKey: keys.booking.slots(slug, q ?? {}),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ serviceId: q!.serviceId, date: q!.date });
      if (q!.staffMemberId) params.set("staffMemberId", q!.staffMemberId);
      if (q!.resourceId) params.set("resourceId", q!.resourceId);
      if (q!.branchId) params.set("branchId", q!.branchId);
      return api.get<SlotsResponse>(`/api/public/${encodeURIComponent(slug)}/slots?${params}`, { anonymous: true, signal });
    },
    // Times go stale as other people book. Short-lived, and refreshed
    // whenever the screen asks — a slot shown is a hint, the create
    // request is the check.
    staleTime: 20_000,
    gcTime: 60_000,
  });
}

export function useQuote(slug: string, serviceId: string | null, code: string | null) {
  return useQuery({
    enabled: serviceId !== null,
    queryKey: keys.booking.quote(slug, serviceId ?? "", code ?? ""),
    queryFn: () =>
      api.post<Quote>(`/api/public/${encodeURIComponent(slug)}/quote`, { serviceId, code: code || undefined }, { anonymous: true }),
    staleTime: 60_000,
  });
}

export function createBooking(slug: string, body: BookingRequest) {
  // Longer than a page load: the server checks the slot, takes a
  // transaction and may open a payment session before it answers. A
  // timeout here is retried with the same key, so waiting is cheaper
  // than giving up early.
  return api.post<CreateBookingResponse>(`/api/public/${encodeURIComponent(slug)}/bookings`, body, {
    anonymous: true,
    timeoutMs: 30_000,
  });
}

/**
 * One booking, as the server has it. Polls while a deposit is being
 * confirmed, and re-reads whenever the app comes back to the
 * foreground — the moment somebody returns from the payment page.
 */
export function useBooking(token: string | undefined) {
  // Polling has a ceiling: past it the webhook is not "on its way", and
  // the screen offers a manual check instead of asking forever.
  const since = useRef<number | null>(null);
  const query = useQuery({
    enabled: Boolean(token),
    queryKey: keys.booking.one(token ?? ""),
    queryFn: () => api.get<PublicBooking>(`/api/public/booking/${encodeURIComponent(token!)}`, { anonymous: true }),
    staleTime: 0,
    refetchInterval: (q) => {
      if (!shouldPoll(q.state.data?.status)) return false;
      since.current ??= Date.now();
      return Date.now() - since.current < POLL_FOR_MS ? 3_000 : false;
    },
  });

  const { refetch } = query;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        since.current = Date.now();
        void refetch();
      }
    });
    return () => sub.remove();
  }, [refetch]);

  return {
    ...query,
    restartPolling: () => {
      since.current = Date.now();
    },
  };
}

/** How long to keep asking after a payment before handing over to the person. */
export const POLL_FOR_MS = 10 * 60_000;
