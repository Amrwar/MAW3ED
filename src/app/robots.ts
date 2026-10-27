import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/url";

/**
 * What a crawler may fetch.
 *
 * Allow is deliberately "/" rather than a list of paths: an allow-list
 * means a new public route is invisible until somebody remembers to add
 * it here, and the previous one had already fallen behind — it listed
 * /cities/ and /categories/ but not the city-and-category pages, the
 * account area, or anything added since.
 *
 * The disallow list is the real content: the places that are either
 * private, useless to a search engine, or a trap.
 */
export default function robots(): MetadataRoute.Robots {
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
          "/notifications",
          "/login",
          "/signup",
          "/account-login",
          "/forgot-password",
          "/reset-password",
          "/verify-email",

          // Not pages: data endpoints and payment returns.
          "/api/",
          "/payment/",

          // A booking's management page is reachable only with its
          // secret token. Indexing one would publish it.
          "/booking/",

          // Filtered search is a combinatorial surface — every
          // permutation of city, category, price, rating and sort is a
          // distinct URL showing a rearrangement of the same listings.
          // The landing pages are the indexable version of this.
          "/businesses?",

          // The same, at their English addresses (lib/locale-path).
          "/en/login",
          "/en/signup",
          "/en/account-login",
          "/en/forgot-password",
          "/en/reset-password",
          "/en/businesses?",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    // No Host: line. It was Yandex-only and is deprecated; the canonical
    // host is already stated by every page's canonical link.
  };
}
