/**
 * Centralized absolute URL builder for Maw3ed public pages.
 * Uses AUTH_URL env var (set by Next Auth) as the base, falling back to the
 * production domain. All URLs are built here so the domain never appears in
 * more than one place.
 */

const BASE = (process.env.AUTH_URL ?? "https://maw3ed.net").replace(/\/$/, "");

/** Full absolute URL for a customer's booking management page */
export function bookingPageUrl(accessToken: string): string {
  return `${BASE}/booking/${accessToken}`;
}

/**
 * The bare host, for showing somebody what their link will look like.
 *
 * Onboarding told every new owner their page would live at
 * "maw3ed.com/company/…", which is a parked empty domain — the site is
 * maw3ed.net. Anyone who followed that instruction shared a dead link.
 * It is derived here so there is one place for it to be wrong.
 *
 * NEXT_PUBLIC_ so a client component can show it; it is a public domain
 * name, not a secret.
 */
export const SITE_HOST = (
  process.env.NEXT_PUBLIC_SITE_HOST ?? "maw3ed.net"
).replace(/^https?:\/\//, "").replace(/\/$/, "");

/** Generic absolute URL for any site path */
export function siteUrl(path: string): string {
  return `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
}
