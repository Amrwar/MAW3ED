import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
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
