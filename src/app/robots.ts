import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/url";
import { siteNoindex } from "@/lib/seo/noindex";

/**
 * What a crawler may fetch.
 *
 * Allow is deliberately "/" rather than a list of paths: an allow-list
 * means a new public route is invisible until somebody remembers to add
 * it here, and the previous one had already fallen behind — it listed
 * the old /cities/ and /categories/ but not the city-and-category pages, the
 * account area, or anything added since.
 *
 * The disallow list is the real content: the places that are either
 * private, useless to a search engine, or a trap.
 */
export default function robots(): MetadataRoute.Robots {
  // A test server: crawlers may fetch, so they read the noindex on every
  // response; no sitemap to follow (src/lib/seo/noindex.ts).
  if (siteNoindex()) return { rules: [{ userAgent: "*", allow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Behind a login. A crawler following these gets a redirect
          // to a sign-in page, every time.
          "/dashboard/",
          "/onboarding/",
          "/account/",
          "/admin/",
          "/org-admin/",
          "/venue-admin/",
          "/notifications",
          "/verify-email",
          // The same at their English addresses (lib/locale-path).
          "/en/dashboard/",
          "/en/onboarding/",
          "/en/account/",
          "/en/admin/",
          "/en/org-admin/",
          "/en/venue-admin/",
          "/en/notifications",
          "/en/verify-email",

          // The reset link carries a token. Kept out of crawlers'
          // hands even though the page says noindex.
          "/reset-password",
          "/en/reset-password",

          // Not the sign-in and sign-up pages. Each says noindex itself,
          // and a crawler has to fetch a page to read that: blocked
          // here, a page every footer links to still got indexed as a
          // bare URL, with nothing to tell the engine to drop it.

          // Not pages: data endpoints and payment returns.
          "/api/",
          "/payment/",

          // A booking's management page is reachable only with its
          // secret token. Indexing one would publish it.
          "/booking/",
          // A waitlist entry is reachable only with its secret link.
          "/booking-waitlist/",

          // Filtered search is a combinatorial surface — every
          // permutation of city, category, price, rating and sort is a
          // distinct URL showing a rearrangement of the same listings.
          // The landing pages are the indexable version of this.
          "/businesses?",

          // The same, at its English address (lib/locale-path).
          "/en/businesses?",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    // No Host: line. It was Yandex-only and is deprecated; the canonical
    // host is already stated by every page's canonical link.
  };
}
