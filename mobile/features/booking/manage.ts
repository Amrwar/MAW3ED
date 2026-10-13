import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { SlotsResponse } from "@/types/api";

/**
 * Changing a booking the customer already has: cancel, move, review.
 *
 * Each is the website's own endpoint, authorised by the booking's access
 * token exactly as the /booking/<token> page is. The rules — the two-hour
 * cutoff, which statuses may move, who may review and when — live on the
 * server; the app shows what the server allows (PublicBooking.canChange,
 * canReview) and reports what it says when it refuses.
 */

function useRefresh(token: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: keys.booking.one(token) });
    void client.invalidateQueries({ queryKey: keys.myBookings.all });
    void client.invalidateQueries({ queryKey: keys.account.reviews });
  };
}

export function useCancelBooking(token: string) {
  const refresh = useRefresh(token);
  return useMutation({
    mutationFn: () => api.post<{ cancelled: true }>(`/api/booking/${encodeURIComponent(token)}/cancel`, undefined, { anonymous: true }),
    onSettled: refresh,
  });
}

/** Times this booking could move to — the server leaves the booking itself out of the grid. */
export function useRescheduleSlots(token: string, date: string | null) {
  return useQuery({
    enabled: Boolean(date),
    queryKey: keys.booking.moveSlots(token, date ?? ""),
    queryFn: ({ signal }) =>
      api.get<SlotsResponse>(`/api/public/booking/${encodeURIComponent(token)}/slots?date=${date}`, { anonymous: true, signal }),
    staleTime: 20_000,
  });
}

export function useReschedule(token: string) {
  const refresh = useRefresh(token);
  return useMutation({
    mutationFn: (to: { date: string; startTime: string }) =>
      api.post<{ date: string; startTime: string; endTime: string; status: string }>(
        `/api/booking/${encodeURIComponent(token)}/reschedule`,
        to,
        { anonymous: true },
      ),
    onSettled: refresh,
  });
}

export function useSubmitReview(token: string, editing: boolean) {
  const refresh = useRefresh(token);
  return useMutation({
    mutationFn: (review: { rating: number; comment: string | null }) =>
      editing
        ? api.patch(`/api/public/booking/${encodeURIComponent(token)}/review`, review, { anonymous: true })
        : api.post(`/api/public/booking/${encodeURIComponent(token)}/review`, review, { anonymous: true }),
    onSettled: refresh,
  });
}
