/**
 * Cross-site request forgery, the second line.
 *
 * The first line is the session cookie's SameSite=Lax attribute, which
 * keeps a browser from attaching it to a POST that another site
 * started. This is the check for the day that is not enough — an old
 * browser, a subdomain takeover, a future cookie change — and it costs
 * one header comparison.
 *
 * A browser puts the page's origin in the Origin header on every
 * cross-site request and on every same-site POST. So a state-changing
 * request to the API that carries our session cookie and names an
 * origin that is not this host was started by somebody else's page,
 * and is refused. Requests without a cookie (the native app, with its
 * bearer token; a webhook; a cron) are not the browser-forgery shape
 * and are left alone, as are the routes that authenticate in their own
 * way.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Routes that carry their own authentication and never a browser session. */
const EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/", "/api/dev/", "/api/auth/mobile/"];

/**
 * NextAuth's own endpoints, which carry their own CSRF token. Only these:
 * the project's custom routes under /api/auth/ (signup, reset, verify
 * email) are ordinary API routes and are checked like the rest.
 */
const NEXTAUTH_ACTION = /^\/api\/auth\/(callback|signin|signout|csrf|session|providers|error|_log)(\/|$)/;

export interface OriginCheckInput {
  method: string;
  pathname: string;
  /** The Origin header, or null when the browser sent none. */
  origin: string | null;
  /** The Host the request arrived on. */
  host: string | null;
  /** Whether a session cookie came with the request. */
  hasSessionCookie: boolean;
}

/** True when the request must be refused as a cross-site forgery. */
export function isCrossSiteMutation(req: OriginCheckInput): boolean {
  if (!MUTATING.has(req.method.toUpperCase())) return false;
  if (!req.pathname.startsWith("/api/")) return false;
  if (EXEMPT_PREFIXES.some((p) => req.pathname.startsWith(p))) return false;
  if (NEXTAUTH_ACTION.test(req.pathname)) return false;
  if (!req.hasSessionCookie) return false;
  // No Origin at all: not a browser cross-site request (browsers always
  // send it for those). "null" is what a sandboxed or data: page sends,
  // and such a page must not act on a session.
  if (req.origin === null) return false;
  if (req.origin === "null") return true;
  let originHost: string;
  try {
    originHost = new URL(req.origin).host;
  } catch {
    return true;
  }
  return !req.host || originHost.toLowerCase() !== req.host.toLowerCase();
}

/** The NextAuth session cookie, under either of the names it uses. */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-)?authjs\.session-token=/.test(cookieHeader);
}
