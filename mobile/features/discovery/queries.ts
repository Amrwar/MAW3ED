import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { BusinessPage, PublicProfile } from "@/types/api";

/**
 * Discovery's reads and the one write it makes (saving a place).
 *
 * The server caches public results for a minute (Cache-Control on
 * /api/public/businesses), so staleTime matches it: refetching sooner
 * would only fetch the same answer again.
 */

/** Pages of results, appended as somebody scrolls. */
export function useSearchResults(query: Record<string, string>, enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.businesses.infinite(query),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ ...query, ...(pageParam > 1 ? { page: String(pageParam) } : {}) });
      const qs = params.toString();
      // Anonymous: the answer is the same for everyone, and a request with
      // no Authorization header is one the CDN may serve from its cache.
      return api.get<BusinessPage>(`/api/public/businesses${qs ? `?${qs}` : ""}`, { signal, anonymous: true });
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pageCount ? last.page + 1 : undefined),
    enabled,
    staleTime: 60_000,
    // No placeholderData: keeping the last search's pages on screen while
    // a new one loads mixed two searches' cards in one list. A new search
    // shows skeletons; one already cached shows at once.
  });
}

/** One business, everything the business screen shows. */
export function useBusinessProfile(slug: string | undefined) {
  return useQuery({
    queryKey: keys.businesses.profile(slug ?? ""),
    queryFn: ({ signal }) => api.get<PublicProfile>(`/api/public/${encodeURIComponent(slug ?? "")}`, { signal, anonymous: true }),
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

/* ─── Saved places ───────────────────────────────────────── */

/** The ids of every saved place, for the heart on each card. Signed-in only. */
export function useFavoriteIds(enabled: boolean) {
  return useQuery({
    queryKey: keys.favorites.ids,
    queryFn: () => api.get<{ businessIds: string[] }>("/api/account/favorites"),
    enabled,
    select: (d) => new Set(d.businessIds),
    staleTime: 5 * 60_000,
  });
}

/**
 * Save or unsave. Optimistic — the heart fills at once and goes back if
 * the server refuses; both requests are idempotent, so a retry is safe.
 */
export function useToggleFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, save }: { businessId: string; save: boolean }) =>
      save
        ? api.post("/api/account/favorites", { businessId })
        : api.delete(`/api/account/favorites?businessId=${encodeURIComponent(businessId)}`),
    onMutate: async ({ businessId, save }) => {
      await client.cancelQueries({ queryKey: keys.favorites.ids });
      const previous = client.getQueryData<{ businessIds: string[] }>(keys.favorites.ids);
      client.setQueryData<{ businessIds: string[] }>(keys.favorites.ids, (old) => {
        const ids = (old?.businessIds ?? []).filter((id) => id !== businessId);
        return { businessIds: save ? [businessId, ...ids] : ids };
      });
      return { previous };
    },
    onError: (_e, _v, context) => {
      if (context?.previous) client.setQueryData(keys.favorites.ids, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.favorites.all }),
  });
}
