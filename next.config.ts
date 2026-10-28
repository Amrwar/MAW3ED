import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import pkg from "./package.json" with { type: "json" };

/**
 * Response headers, which the site was serving none of.
 *
 * Each one closes something specific:
 *
 *   nosniff            stops a browser deciding an uploaded file is
 *                      JavaScript because its first bytes look like it.
 *   frame-ancestors    nobody frames a Maw3ed page. Paymob is a
 *                      redirect, not an embed, so this costs nothing.
 *   Referrer-Policy    a booking page URL carries a slug and a channel;
 *                      it should not leak in full to third parties.
 *   HSTS               the site is already HTTPS-only in production;
 *                      this stops the first request being the weak one.
 *                      Not preloaded — that is a decision with a long
 *                      undo, and it is yours to make.
 *   Permissions-Policy nothing here needs a camera, a microphone or a
 *                      payment handler, so nothing may ask.
 *
 * Not here: Content-Security-Policy. It carries a per-request nonce, so
 * it is built in src/proxy.ts from src/lib/security/csp.ts — these
 * headers are computed once at build time, which would hand every
 * visitor the same nonce and defeat the point of having one.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/**
 * Read once at build time so the running app can say which build it is.
 * Vercel sets VERCEL_GIT_COMMIT_SHA on every deployment; locally there
 * is none, and the UI prints just the version.
 */


const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },

  // The header advertises the framework and its major version to
  // anybody scanning for a known issue in it.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

/**
 * Sentry wraps the build to upload source maps, so a stack trace points
 * at real code rather than minified output.
 *
 * Upload only happens when SENTRY_AUTH_TOKEN, org and project are all
 * set. Without them the wrapper is a no-op and the build is unchanged —
 * which keeps CI and any deploy without Sentry credentials working.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  silent: !process.env.CI,
  // Source maps are uploaded then deleted, so they are never served.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Routes browser requests around ad blockers that drop /sentry paths.
  tunnelRoute: "/monitoring",
  telemetry: false,
});
