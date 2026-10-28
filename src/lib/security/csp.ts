/**
 * The Content-Security-Policy, built per request around a fresh nonce.
 *
 * next.config.ts has carried a note for a while explaining why this was
 * missing: Next inlines bootstrap scripts, so a policy strict enough to
 * be worth having needs a nonce on every one of them, and getting it
 * wrong breaks the page it is meant to protect. This is that pass.
 *
 * Why a nonce rather than a list of allowed hosts: the thing a policy
 * is defending against here is injected markup — a business name, a
 * review, a service description that comes back out of the database and
 * into a page. A host allowlist does nothing about an inline <script>
 * that is already on the page. A nonce does: the browser runs only the
 * scripts carrying this request's random value, and an attacker writing
 * into the database cannot know it.
 *
 * It is defence in depth, not the defence. The structured-data
 * injection this would have mitigated is escaped at source in
 * seo/jsonld-script.ts, and that remains the real fix. This is the
 * second line for the holes nobody has found yet.
 */

/** Hosts that serve images, mirroring next.config.ts remotePatterns. */
const IMAGE_HOSTS = ["https://res.cloudinary.com", "https://images.unsplash.com"];

export interface CspOptions {
  nonce: string;
  /** Development needs eval for hot reloading; production must not have it. */
  development?: boolean;
}

/**
 * Builds the policy.
 *
 * Decisions worth defending, since each is a place this could be
 * tightened or has had to be loosened:
 *
 * `'strict-dynamic'` on script-src. Next's bootstrap script loads the
 *   route chunks itself, and without this every chunk would need its
 *   own nonce threaded through the framework. With it, a script the
 *   nonce already trusts may load more. It also makes browsers ignore
 *   the `https:` beside it, which is left there only so a browser too
 *   old for strict-dynamic degrades to something rather than nothing.
 *
 * `'unsafe-inline'` on style-src. React sets element style attributes,
 *   and so does every inline `style={{...}}` in the codebase; CSP counts
 *   those as inline styles. Nonces do not apply to attributes, so the
 *   alternative is removing all of them. An injected style can deface a
 *   page but cannot read a cookie or call an endpoint, so this is the
 *   compromise nearly every CSP makes.
 *
 * `connect-src 'self'`. Sentry tunnels through /monitoring, which is
 *   same-origin, so no ingest host is needed here. Paymob is reached by
 *   redirecting the whole page, not by fetch, so it needs nothing
 *   either.
 *
 * `frame-src 'self'`. Paymob's hosted page is a navigation, not an
 *   embed. If a deposit ever moves into an iframe, this is the line
 *   that will have to name accept.paymob.com, and it will fail loudly
 *   rather than quietly.
 *
 * `object-src 'none'`. There are no plugins, and <object> is a classic
 *   way to smuggle one in.
 *
 * `base-uri 'self'`. An injected <base> rewrites every relative URL on
 *   the page, including the ones the bootstrap script fetches.
 */
export function buildCsp({ nonce, development = false }: CspOptions): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https:",
    // Hot reloading compiles in the browser. Never in production: with
    // eval available, an injected string becomes executable code.
    ...(development ? ["'unsafe-eval'"] : []),
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...IMAGE_HOSTS],
    "font-src": ["'self'", "data:"],
    // Dev tooling opens a websocket back to the server.
    "connect-src": development ? ["'self'", "ws:", "wss:"] : ["'self'"],
    "frame-src": ["'self'"],
    // The same statement X-Frame-Options makes, for browsers that
    // prefer this one. Both are sent; they agree.
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  // Only in production: on http://localhost this would upgrade every
  // request to https and nothing would load.
  return development ? policy : `${policy}; upgrade-insecure-requests`;
}

/**
 * A fresh nonce.
 *
 * Must be unguessable and must never repeat, or the policy means
 * nothing: an attacker who learns one nonce, or can predict the next,
 * can author a script tag that passes. crypto.getRandomValues is the
 * Web Crypto API, available in the proxy and anywhere else this runs.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // base64 without Buffer, which the Edge runtime also lacks.
  return btoa(String.fromCharCode(...bytes));
}
