/**
 * Auth config without database imports, used by the proxy (src/proxy.ts).
 *
 * The proxy runs on every request, so it stays light: no Prisma client
 * here. Database checks belong in src/auth.ts or the route itself.
 */
import type { NextAuthConfig } from "next-auth";
import { hasTwin, splitLang } from "@/lib/locale-path";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // /en/login is /login in English: the rules are about the page.
      const { lang, path } = splitLang(nextUrl.pathname);
      // /en/dashboard and the like: the proxy first sends these to their
      // one address and saves the language; the check runs on that
      // request. Redirecting from here would skip the proxy and lose it.
      if (lang !== null && !hasTwin(path)) return true;

      const isProtected =
        path.startsWith("/dashboard") || path.startsWith("/onboarding");
      const isAuthPage = path === "/login" || path === "/signup";

      if (isProtected) {
        return isLoggedIn; // redirect to /login if false
      }

      // The customer area. Guarded here rather than only in the layout
      // because the proxy is the one place that knows which path was
      // asked for: somebody who follows a link to /account/favorites and
      // has to sign in first gets sent back to favorites, instead of
      // being dumped on the account home having lost where they were
      // going. Note /account-login itself starts with "/account", hence
      // the exact match plus trailing slash rather than startsWith.
      if (
        path === "/account" ||
        path.startsWith("/account/") ||
        path === "/notifications"
      ) {
        if (!isLoggedIn) {
          const url = new URL("/account-login", nextUrl);
          url.searchParams.set("next", path + nextUrl.search);
          return Response.redirect(url);
        }
        return true;
      }
      // Redirect logged-in users away from auth pages
      if (isAuthPage && isLoggedIn) {
        const u = auth?.user as { businessId?: string | null; adminRole?: string | null } | undefined;
        // By what the account is: an owner to the dashboard, an
        // administrator without a business to the admin, and anybody
        // else on to setting up their business.
        const home = u?.businessId ? "/dashboard" : u?.adminRole ? "/admin" : "/onboarding";
        return Response.redirect(new URL(home, nextUrl));
      }
      return true;
    },
  },
  providers: [], // providers added in auth.ts (Node)
};
