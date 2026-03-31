import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Use lightweight edge-compatible config (no DB) for middleware
export default NextAuth(authConfig).auth;

export const config = {
  // Skip Next.js internals, static files, public assets
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.png$|.*\\.svg$).*)",
  ],
};
