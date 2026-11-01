import { safeNext } from "@/lib/account/safe-next";

/**
 * Where the business login sends somebody once they are signed in.
 *
 * A page that sent them here says where to come back to: NextAuth's
 * `callbackUrl` (the proxy's redirect), or `next` (the venue, group and
 * scanned-code pages). Only a same-site path is honoured, and only into
 * the places this login is for:
 *
 *   /dashboard…      the business's own pages — for an account with a business;
 *   /venue-admin…    venue operators and venue security;
 *   /org-admin…      group managers;
 *   /c/<code>        a booking QR scanned with a phone camera.
 *
 * Each of those pages decides access again; a path here only says where
 * to try. Anything else falls back to the account's home: the dashboard
 * for an owner, the admin for an administrator without a business,
 * onboarding for an owner who has not set one up yet.
 *
 * None of those pages sends a signed-in person back to /login, so coming
 * back cannot loop.
 */
const RETURNABLE = [/^\/venue-admin(\/|$)/, /^\/org-admin(\/|$)/, /^\/c\/[^/]+$/];

export function loginDestination(
  search: string,
  origin: string,
  user: { businessId?: string | null; adminRole?: string | null } | undefined,
): string {
  const params = new URLSearchParams(search);
  for (const raw of [params.get("next"), params.get("callbackUrl")]) {
    const path = returnPath(raw, origin);
    if (!path) continue;
    const bare = path.split("?")[0].replace(/^\/en(?=\/|$)/, "") || "/";
    if (user?.businessId && /^\/dashboard(\/|$)/.test(bare)) return path;
    if (RETURNABLE.some((r) => r.test(bare))) return path;
  }
  if (!user?.businessId) return user?.adminRole ? "/admin" : "/onboarding";
  return "/dashboard";
}

/** A same-site path (with its query) from `next` or `callbackUrl`, else null. */
function returnPath(raw: string | null, origin: string): string | null {
  if (!raw) return null;
  let candidate = raw;
  // callbackUrl is usually absolute: keep it only when it is this site.
  if (/^https?:/i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.origin !== origin) return null;
      candidate = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  const safe = safeNext(candidate);
  return safe === "/account" && candidate !== "/account" ? null : safe;
}
