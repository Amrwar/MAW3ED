import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type {
  BusinessPage,
  Facets,
  MyBookingsResponse,
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
  /** The web's discovery sorts (src/lib/discovery/params.ts SORTS). */
  sort?: "recommended" | "rating" | "most-booked" | "price-asc" | "price-desc" | "soonest";
  /** The API's name is `available`. */
  available?: "any" | "today" | "tomorrow" | "open-now";
}

export function useBusinesses(params: SearchParams = {}, enabled = true) {
  const query: Record<string, string> = {};
  if (params.q?.trim()) query.q = params.q.trim();
  if (params.city) query.city = params.city;
  if (params.category) query.category = params.category;
  if (params.page && params.page > 1) query.page = String(params.page);
  if (params.sort && params.sort !== "recommended") query.sort = params.sort;
  if (params.available && params.available !== "any") query.available = params.available;

  return useQuery({
    queryKey: keys.businesses.search(query),
    queryFn: () => {
      const search = new URLSearchParams(query).toString();
      return api.get<BusinessPage>(`/api/public/businesses${search ? `?${search}` : ""}`);
    },
    enabled,
    // Public data, and the same results a browser would get. No reason
    // to refetch it every time a tab regains focus.
    staleTime: 5 * 60_000,
  });
}

/**
 * Categories and cities with how many published businesses each holds —
 * the website's filter facets (GET /api/public/facets). Counts are real,
 * so nothing empty is offered as if it had places in it.
 */
export function useFacets(city?: string, enabled = true) {
  return useQuery({
    enabled,
    queryKey: keys.facets(city ?? ""),
    queryFn: () => api.get<Facets>(`/api/public/facets${city ? `?city=${encodeURIComponent(city)}` : ""}`),
    staleTime: 10 * 60_000,
  });
}

/* ─── The customer's own bookings ────────────────────────── */

/**
 * `enabled` is false for a signed-out visitor: Home shows the next
 * booking to people who have one, and asking anonymously only earns a
 * 401 for nothing.
 */
export function useMyBookings(scope: "upcoming" | "history", enabled = true) {
  return useQuery({
    queryKey: keys.myBookings.scope(scope),
    queryFn: () => api.get<MyBookingsResponse>(`/api/account/bookings?scope=${scope}`),
    enabled,
    // An appointment can be minutes away, so this is the one list where
    // being a minute behind actually matters.
    staleTime: 30_000,
  });
}

/* ─── Saved places ───────────────────────────────────────── */

export function useFavorites() {
  return useQuery({
    queryKey: keys.favorites.list,
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
      const previous = client.getQueryData<{ favorites: SavedBusiness[] }>(keys.favorites.list);
      client.setQueryData<{ favorites: SavedBusiness[] }>(keys.favorites.list, (old) =>
        old ? { favorites: old.favorites.filter((f) => f.id !== businessId) } : old,
      );
      return { previous };
    },
    onError: (_error, _businessId, context) => {
      if (context?.previous) client.setQueryData(keys.favorites.list, context.previous);
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

