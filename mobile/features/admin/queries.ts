import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";

/**
 * GET /api/admin/overview — the figures on the web admin's landing page,
 * computed by the same function (src/lib/admin/overview.ts). null where
 * the role may not see a figure.
 */
export interface AdminOverview {
  role: "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
  pendingBusinesses: number | null;
  totalBusinesses: number | null;
  suspendedBusinesses: number | null;
  openReports: number | null;
  reviewsUnderReview: number | null;
  paidBookings: number | null;
}

export function useAdminOverview() {
  return useQuery({
    queryKey: keys.admin.overview,
    queryFn: () => api.get<AdminOverview>("/api/admin/overview"),
  });
}
