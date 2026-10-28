import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { buildCsp, generateNonce } from "./lib/security/csp";

// The lightweight config (no DB), shared with auth.config.ts's authorized().
const { auth } = NextAuth(authConfig);

/**
 * Auth, plus the Content-Security-Policy.
 *
 * The policy lives here rather than in next.config.ts because it
 * carries a nonce, and a nonce has to be new on every request —
 * next.config.ts headers are computed once at build time, which would
 * give every visitor the same value and defeat the point of having one.
 *
 * Two places need to see it:
 *
 *   the response, which is what the browser enforces;
 *
 *   the request, which is where Next looks for it. Next parses the
 *   nonce out of this header and stamps it onto the bootstrap and chunk
 *   script tags it injects. Without it those tags go out unnonced and
 *   a strict-dynamic policy blocks the page's own JavaScript.
 *
 * x-nonce is set as well, for the handful of server components that
 * render a JSON-LD <script> and have to put the nonce on it themselves.
 *
 * Note the shape: `auth(callback)`. The callback runs only after the
 * authorized() callback in auth.config.ts has allowed the request, so
 * wrapping it does not weaken route protection — a redirect returned
 * there is returned before this runs.
 *
 * Next 16 renamed middleware to proxy; this file was src/middleware.ts.
 */
export default auth((req) => {
  const nonce = generateNonce();
  const csp = buildCsp({ nonce, development: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
});

export const config = {
  // Skip Next.js internals, static files, public assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.png$|.*\\.svg$).*)",
  ],
};
