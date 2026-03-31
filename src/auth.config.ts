/**
 * Edge-compatible auth config — no DB imports allowed here.
 * Used by middleware (Edge runtime).
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      const isProtected =
        path.startsWith("/dashboard") || path.startsWith("/onboarding");
      const isAuthPage = path === "/login" || path === "/signup";

      if (isProtected) {
        return isLoggedIn; // redirect to /login if false
      }
      // Redirect logged-in users away from auth pages
      if (isAuthPage && isLoggedIn) {
        const hasOnboarded = !!(auth?.user as { businessId?: string })
          ?.businessId;
        return Response.redirect(
          new URL(hasOnboarded ? "/dashboard" : "/onboarding", nextUrl)
        );
      }
      return true;
    },
  },
  providers: [], // providers added in auth.ts (Node)
};
