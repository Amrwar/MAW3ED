import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type {
  BusinessPage,
  MyBookingsResponse,
  NotificationsResponse,
  Profile,
  SavedBusiness,
} from "@/types/api";

/**
 * What the customer screens read.
 *
 * Every screen talks to the server through one of these rather than
 * calling api.get itself, so caching, retries and invalidation are
 * decided once. A screen that fetches on its own is a screen that will
 * show stale data after somebody books.
 */

/* ─── Discovery ──────────────────────────────────────────── */

export interface SearchParams {
  q?: string;
  city?: string;
  category?: string;
  page?: number;
}

export function useBusinesses(params: SearchParams = {}) {
  const query: Record<string, string> = {};
  if (params.q?.trim()) query.q = params.q.trim();
  if (params.city) query.city = params.city;
  if (params.category) query.category = params.category;
  if (params.page && params.page > 1) query.page = String(params.page);

  return useQuery({
    queryKey: keys.businesses.search(query),
    queryFn: () => {
      const search = new URLSearchParams(query).toString();
      return api.get<BusinessPage>(`/api/public/businesses${search ? `?${search}` : ""}`);
    },
    // Public data, and the same results a browser would get. No reason
    // to refetch it every time a tab regains focus.
    staleTime: 5 * 60_000,
  });
}

/* ─── The customer's own bookings ────────────────────────── */

export function useMyBookings(scope: "upcoming" | "history") {
  return useQuery({
    queryKey: keys.myBookings.scope(scope),
    queryFn: () => api.get<MyBookingsResponse>(`/api/account/bookings?scope=${scope}`),
    // An appointment can be minutes away, so this is the one list where
    // being a minute behind actually matters.
    staleTime: 30_000,
  });
}

/* ─── Saved places ───────────────────────────────────────── */

export function useFavorites() {
  return useQuery({
    queryKey: keys.favorites.all,
    queryFn: () =>
      api.get<{ favorites: SavedBusiness[] }>("/api/account/favorites?expand=1"),
  });
}

export function useRemoveFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (businessId: string) =>
      api.delete<{ removed: boolean }>(`/api/account/favorites?businessId=${businessId}`),
    // Optimistic: unsaving should feel instant, and the request is
    // idempotent, so a failure can simply put the row back.
    onMutate: async (businessId) => {
      await client.cancelQueries({ queryKey: keys.favorites.all });
      const previous = client.getQueryData<{ favorites: SavedBusiness[] }>(keys.favorites.all);
      client.setQueryData<{ favorites: SavedBusiness[] }>(keys.favorites.all, (old) =>
        old ? { favorites: old.favorites.filter((f) => f.id !== businessId) } : old,
      );
      return { previous };
    },
    onError: (_error, _businessId, context) => {
      if (context?.previous) client.setQueryData(keys.favorites.all, context.previous);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: keys.favorites.all });
    },
  });
}

/* ─── Account ────────────────────────────────────────────── */

export function useProfile() {
  return useQuery({
    queryKey: keys.profile.all,
    queryFn: () => api.get<Profile>("/api/account/profile"),
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<Profile, "name" | "email" | "notifyByWhatsApp" | "notifyByEmail">>) =>
      api.patch<{ user: Profile }>("/api/account/profile", patch),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.profile.all });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications.all,
    queryFn: () => api.get<NotificationsResponse>("/api/account/notifications"),
  });
}
