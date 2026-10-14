import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { Analytics, CustomersResponse } from "@/types/api";
import type { BookingDetail, BusinessProfile, CalendarResponse, CustomerDetail, Overview, ServiceRow, StaffRow } from "./types";

/**
 * What the owner's screens read.
 *
 * Same rule as the customer hooks: screens do not call api.get
 * directly. It matters more here, because confirming a booking has to
 * refresh the list, the calendar and the dashboard counts at once, and
 * that only works if they share keys.
 */

/* ─── Bookings ───────────────────────────────────────────── */

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

export function useBusinessCustomers(search?: string, enabled = true) {
  return useQuery({
    enabled,
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

/* ─── The day-to-day side (owner and staff) ──────────────── */

/** The morning look: today, what's next, what's waiting, what changed. */
export function useOverview(enabled = true) {
  return useQuery({
    queryKey: keys.business.overview,
    queryFn: () => api.get<Overview>("/api/business/overview"),
    enabled,
    staleTime: 30_000,
    // An owner glancing at the phone between customers: keep it current.
    refetchInterval: 60_000,
  });
}

export interface CalendarFilters {
  dateFrom: string;
  dateTo: string;
  staffId?: string;
  branchId?: string;
  status?: string;
}

/** Every booking in a range (at most 31 days), in time order. */
export function useCalendar(filters: CalendarFilters) {
  const query: Record<string, string> = { view: "calendar", dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  if (filters.staffId) query.staffId = filters.staffId;
  if (filters.branchId) query.branchId = filters.branchId;
  if (filters.status && filters.status !== "ALL") query.status = filters.status;
  return useQuery({
    queryKey: keys.business.calendar(query),
    queryFn: () => api.get<CalendarResponse>(`/api/business/bookings?${new URLSearchParams(query).toString()}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useBookingDetail(id: string) {
  return useQuery({
    queryKey: keys.business.booking(id),
    queryFn: () => api.get<BookingDetail>(`/api/business/bookings/${encodeURIComponent(id)}`),
  });
}

/** Free times this booking could move to on `date`. */
export function useRescheduleSlots(id: string, date: string | null) {
  return useQuery({
    queryKey: keys.business.slots(id, date ?? ""),
    queryFn: () => api.get<{ date: string; slots: string[]; reason: string | null }>(
      `/api/business/bookings/${encodeURIComponent(id)}/reschedule?date=${date}`,
    ),
    enabled: Boolean(date),
    staleTime: 15_000,
  });
}

export function useRescheduleBooking(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (to: { date: string; startTime: string }) =>
      api.post<{ id: string; date: string; startTime: string; endTime: string; status: string }>(
        `/api/business/bookings/${encodeURIComponent(id)}/reschedule`,
        to,
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.business.all }),
  });
}

export function useBusinessCustomer(id: string) {
  return useQuery({
    queryKey: keys.business.customer(id),
    queryFn: () => api.get<CustomerDetail>(`/api/business/customers/${encodeURIComponent(id)}`),
  });
}

export function useStaff() {
  return useQuery({ queryKey: keys.business.staff, queryFn: () => api.get<StaffRow[]>("/api/business/staff"), staleTime: 5 * 60_000 });
}

export function useServices() {
  return useQuery({ queryKey: keys.business.services, queryFn: () => api.get<ServiceRow[]>("/api/business/services"), staleTime: 5 * 60_000 });
}

export function useBusinessProfile() {
  return useQuery({ queryKey: keys.business.profile, queryFn: () => api.get<BusinessProfile>("/api/business/profile"), staleTime: 5 * 60_000 });
}

/** The owner gives or takes a staff member's app access. */
export function useSetStaffAccess() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, access, phone }: { id: string; access: "MANAGER" | "PROVIDER" | null; phone?: string }) =>
      api.put<{ id: string; access: string | null; loginPhone: string | null; linked: boolean }>(
        `/api/business/staff/${encodeURIComponent(id)}/access`,
        { access, phone },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.business.staff }),
  });
}
