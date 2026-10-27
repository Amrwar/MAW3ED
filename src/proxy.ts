import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";
import { buildCsp, generateNonce } from "./lib/security/csp";
import { LANG_COOKIE, LANG_COOKIE_MAX_AGE, LANG_HEADER } from "./lib/lang";
import { routeLocale } from "./lib/locale-routing";

// The lightweight config (no DB), shared with auth.config.ts's authorized().
const { auth } = NextAuth(authConfig);

/**
 * Auth, the page's language, and the Content-Security-Policy.
 *
 * Language: lib/locale-routing decides from the path, the query and the
 * saved choice. English pages are served by rewriting /en/x to /x, so
 * each page is written once; the language travels to it on the request
 * as x-maw3ed-lang, which getLang() reads.
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
  const locale = routeLocale({
    pathname: req.nextUrl.pathname,
    search: req.nextUrl.search,
    method: req.method,
    cookieLang: req.cookies.get(LANG_COOKIE)?.value,
  });
  if (locale.type === "redirect") {
    return remember(NextResponse.redirect(new URL(locale.to, req.nextUrl), 307), locale.remember);
  }

  const nonce = generateNonce();
  const csp = buildCsp({ nonce, development: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  // Always set, so a header sent by the client is never believed.
  requestHeaders.set(LANG_HEADER, locale.lang);

  const res =
    locale.type === "rewrite"
      ? NextResponse.rewrite(new URL(locale.to, req.nextUrl), { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return remember(res, locale.type === "rewrite" ? locale.remember : undefined);
});

/** Saves the language as the visitor's choice, as the switch does. */
function remember(res: NextResponse, lang: "ar" | "en" | undefined): NextResponse {
  if (lang) res.cookies.set(LANG_COOKIE, lang, { path: "/", maxAge: LANG_COOKIE_MAX_AGE, sameSite: "lax" });
  return res;
}

export const config = {
  // Skip Next.js internals, static files, public assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.png$|.*\\.svg$).*)",
  ],
};
