/**
 * Turning an English name into a URL slug.
 *
 * Here rather than in lib/api.ts, where it used to sit beside the
 * session guards. Two client components import it, and importing it
 * from there pulled next/headers into the browser bundle — which only
 * became a build error once the guards started reading a header. A pure
 * string function has no reason to live next to authentication.
 */
export function makeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}
