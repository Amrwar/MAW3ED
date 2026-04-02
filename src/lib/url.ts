/**
 * Centralized absolute URL builder for Maw3ed public pages.
 * Uses AUTH_URL env var (set by Next Auth) as the base, falling back to the
 * production domain. All URLs are built here so the domain never appears in
 * more than one place.
 */

const BASE = (process.env.AUTH_URL ?? "https://maw3ed.app").replace(/\/$/, "");

/** Full absolute URL for a customer's booking management page */
export function bookingPageUrl(accessToken: string): string {
  return `${BASE}/booking/${accessToken}`;
}

/** Generic absolute URL for any site path */
export function siteUrl(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
