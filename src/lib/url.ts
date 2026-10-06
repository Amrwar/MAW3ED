/**
 * Absolute URLs for public pages.
 *
 * There is a second resolver in lib/env.ts and that is deliberate, not
 * an oversight: env.ts is server-only by design, and this module is
 * imported by client components for SITE_HOST. They read the same
 * variables in the same order so they cannot disagree about what the
 * site is called — if one changes, change both.
 */

const BASE = (
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://maw3ed.net"
).replace(/\/+$/, "");

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
