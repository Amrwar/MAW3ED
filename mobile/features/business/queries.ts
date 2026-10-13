import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { Analytics, BusinessBookingsResponse, CustomersResponse } from "@/types/api";

/**
 * What the owner's screens read.
 *
 * Same rule as the customer hooks: screens do not call api.get
 * directly. It matters more here, because confirming a booking has to
 * refresh the list, the calendar and the dashboard counts at once, and
 * that only works if they share keys.
 */

/* ─── Bookings ───────────────────────────────────────────── */

export interface BookingFilters {
  /** "YYYY-MM-DD". Omitted means every date. */
  date?: string;
  status?: string;
  page?: number;
}

export function useBusinessBookings(filters: BookingFilters = {}) {
  const query: Record<string, string> = {};
  if (filters.date) query.date = filters.date;
  if (filters.status && filters.status !== "ALL") query.status = filters.status;
  if (filters.page && filters.page > 1) query.page = String(filters.page);

  return useQuery({
    queryKey: keys.business.bookings(query),
    queryFn: () => {
      const search = new URLSearchParams(query).toString();
      return api.get<BusinessBookingsResponse>(
        `/api/business/bookings${search ? `?${search}` : ""}`,
      );
    },
    // An owner watching today's list wants it current; somebody books
    // while they are looking at it.
    staleTime: 30_000,
  });
}

export function useUpdateBookingStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch<{ booking: { id: string; status: string } }>(`/api/business/bookings/${id}`, {
        status,
      }),
    // Not optimistic, deliberately. Confirming an appointment is a
    // promise to a customer, and showing it as confirmed before the
    // server agreed would be a lie if the request failed. The list is
    // small, so the refetch is quick.
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.business.all });
    },
  });
}

/* ─── Customers ──────────────────────────────────────────── */

export function useBusinessCustomers(search?: string) {
  return useQuery({
    queryKey: keys.business.customers(search),
    queryFn: () => {
      const params = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
      return api.get<CustomersResponse>(`/api/business/customers${params}`);
    },
  });
}

/* ─── Dashboard numbers ──────────────────────────────────── */

/**
 * `from` and `to` are required by the endpoint, so the caller passes a
 * window rather than this inventing one — a dashboard showing "this
 * month" and a report showing "last 30 days" are different questions
 * and should not silently share a default.
 */
export function useAnalytics(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.business.analytics(from, to),
    queryFn: () => api.get<Analytics>(`/api/business/analytics?from=${from}&to=${to}`),
    enabled,
    // Yesterday's totals do not change. Worth caching longer than a
    // booking list.
    staleTime: 5 * 60_000,
  });
}
