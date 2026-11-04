import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { sourceOf } from "@/features/profile/visit-source";
import type { OrgDetail, OrgSummary, VenueDetail, VenueSummary } from "@/types/places";

/**
 * Organizations and venues, from the public endpoints the website's pages
 * use. Anonymous, like the rest of discovery: browsing a mall does not
 * need an account.
 */

export function useOrganizations() {
  return useQuery({
    queryKey: keys.places.organizations,
    queryFn: ({ signal }) => api.get<{ organizations: OrgSummary[] }>("/api/public/groups", { anonymous: true, signal }),
    staleTime: 5 * 60_000,
  });
}

export function useOrganization(slug: string | undefined) {
  return useQuery({
    enabled: Boolean(slug),
    queryKey: keys.places.organization(slug ?? ""),
    queryFn: ({ signal }) => api.get<{ organization: OrgDetail }>(`/api/public/groups/${encodeURIComponent(slug!)}`, { anonymous: true, signal }),
    staleTime: 2 * 60_000,
  });
}

export function useVenues() {
  return useQuery({
    queryKey: keys.places.venues,
    queryFn: ({ signal }) => api.get<{ venues: VenueSummary[] }>("/api/public/venues", { anonymous: true, signal }),
    staleTime: 5 * 60_000,
  });
}

export function useVenue(slug: string | undefined) {
  return useQuery({
    enabled: Boolean(slug),
    queryKey: keys.places.venue(slug ?? ""),
    queryFn: ({ signal }) => api.get<{ venue: VenueDetail }>(`/api/public/venues/${encodeURIComponent(slug!)}`, { anonymous: true, signal }),
    staleTime: 2 * 60_000,
  });
}

/** One visit to an organization's page, by channel (a QR code, a shared link…), as the website counts it. */
export function countOrganizationVisit(slug: string, src: string | null | undefined) {
  void api
    .post(`/api/public/groups/${encodeURIComponent(slug)}/view`, { source: sourceOf(src) }, { anonymous: true })
    .catch(() => undefined);
}
