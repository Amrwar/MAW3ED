import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import type { ReviewPage } from "@/types/api";
import { reportPath, type ReportReason } from "./report";

/** The reviews endpoint's own cap. */
const MAX_PAGE = 100;

export type ReviewSort = "recent" | "highest" | "lowest" | "helpful";

/**
 * Every review for one business, ten at a time, newest first unless
 * asked otherwise. The profile carries the latest five; this is the
 * "See all" behind them.
 */
export function useBusinessReviews(slug: string, sort: ReviewSort, rating: number | null) {
  return useInfiniteQuery({
    queryKey: keys.businesses.reviews(slug, sort, rating),
    queryFn: ({ pageParam, signal }) => {
      const q = [`sort=${sort}`, `page=${pageParam}`];
      if (rating) q.push(`rating=${rating}`);
      return api.get<ReviewPage>(`/api/public/${encodeURIComponent(slug)}/reviews?${q.join("&")}`, {
        signal,
        anonymous: true,
      });
    },
    initialPageParam: 1,
    // The server stops at page 100 and answers anything past it with
    // page 100 again; an empty or repeated page ends the list too.
    getNextPageParam: (last, _all, lastParam) =>
      last.reviews.length > 0 && last.page === lastParam && last.page < MAX_PAGE && last.page * last.pageSize < last.matched
        ? last.page + 1
        : undefined,
    enabled: Boolean(slug),
    staleTime: 60_000,
  });
}

/**
 * Reports one review to the moderators. Anonymous on purpose: the
 * server limits reports per device, not per account, and a signed-out
 * reader can report too.
 */
export function useReportReview() {
  return useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: ReportReason }) =>
      api.post<{ reported: true }>(reportPath(reviewId), { reason }, { anonymous: true }),
  });
}
