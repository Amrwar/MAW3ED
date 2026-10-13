import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getTokens } from "@/features/auth/token-store";
import type { AccountPayment, AccountSession, MyBookingsResponse, MyReview } from "@/types/api";

/**
 * The customer's account, read from the same endpoints the website's
 * account pages are built on. Every one is scoped to the signed-in
 * person on the server; nothing here passes an id the server trusts.
 */

/** Past bookings, a page at a time — history can be long. */
export function useBookingHistory(enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: keys.myBookings.historyPages,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<MyBookingsResponse>(`/api/account/bookings?scope=history&take=20&skip=${pageParam}`),
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.bookings.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    staleTime: 60_000,
  });
}

export function useMyReviews() {
  return useQuery({
    queryKey: keys.account.reviews,
    queryFn: () => api.get<{ reviews: MyReview[]; needsPhone: boolean }>("/api/account/reviews"),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: keys.account.payments,
    queryFn: () => api.get<{ payments: AccountPayment[]; needsPhone: boolean }>("/api/account/payments"),
  });
}

/** Devices signed in through the app. This device is marked by its own refresh token. */
export function useSessions() {
  return useQuery({
    queryKey: keys.account.sessions,
    queryFn: async () => {
      const tokens = await getTokens();
      return api.get<{ sessions: AccountSession[] }>("/api/account/sessions", {
        headers: tokens?.refreshToken ? { "x-refresh-token": tokens.refreshToken } : undefined,
      });
    },
  });
}

export function useEndSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (which: { sessionId: string } | "others") => {
      if (which === "others") {
        const tokens = await getTokens();
        if (!tokens?.refreshToken) throw new Error("no session");
        return api.post<{ ended: number }>("/api/account/sessions", { allExcept: tokens.refreshToken });
      }
      return api.post<{ ended: number }>("/api/account/sessions", which);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.account.sessions }),
  });
}

export function useRequestDeletionCode() {
  return useMutation({
    mutationFn: () => api.post<{ sent: true; phone: string }>("/api/account/delete/code"),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (code: string) => api.post<{ deleted: true }>("/api/account/delete", { code, confirm: "DELETE" }),
  });
}
