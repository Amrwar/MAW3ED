import type { Metadata } from "next";
import { siteUrl } from "@/lib/url";

/**
 * Titles, descriptions and canonicals, in one place.
 *
 * Two rules live here that are easy to get wrong separately and have to
 * agree everywhere:
 *
 *   1. A canonical is absolute and has no query string on it beyond the
 *      page it identifies. Two URLs that show the same thing must name
 *      the same canonical, or they compete with each other.
 *
 *   2. Page one of a list is the list. /businesses and /businesses?page=1
 *      are the same page, so page one canonicalises to the clean URL and
 *      the "?page=1" form never appears anywhere.
 *
 * There is deliberately no hreflang. Arabic and English are served from
 * the same URL, chosen by a cookie, so there is no second URL to point
 * at — and an hreflang tag pointing back at itself tells Google two
 * languages share one address, which is worse than saying nothing. See
 * the note in README-SEO.md for what an /en prefix would involve.
 */

/** Everything after page one is a continuation, not a page to index. */
export interface PageMeta {
  title: string;
  description: string;
  /** Path only, e.g. "/cairo/clinics". */
  path: string;
  page?: number;
  /** Absolute or site-relative image for sharing. */
  image?: string | null;
}

export function canonicalFor(path: string, page = 1): string {
  const clean = path.split("?")[0];
  // Page one is the page. Only a later page carries the parameter, and
  // it carries nothing else.
  return page > 1 ? siteUrl(`${clean}?page=${page}`) : siteUrl(clean);
}

export function buildMetadata({
  title,
  description,
  path,
  page = 1,
  image,
}: PageMeta): Metadata {
  const canonical = canonicalFor(path, page);
  const pagedTitle = page > 1 ? `${title} — صفحة ${page}` : title;

  return {
    title: pagedTitle,
    description,
    alternates: { canonical },
    robots:
      page > 1
        ? {
            // Page two of a list is not a landing page: its value is the
            // links on it, not the page itself. Followed so the
            // businesses on it are still discovered, not indexed so it
            // does not compete with page one for the same search.
            index: false,
            follow: true,
          }
        : { index: true, follow: true },
    openGraph: {
      title: pagedTitle,
      description,
      url: canonical,
      siteName: "موعد MAW3ED",
      locale: "ar_EG",
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: pagedTitle,
      description,
    },
  };
}

// Page size is not defined here: discovery/params already owns it as
// PAGE_SIZE, and a second constant would be a second answer to where
// page two begins.

/** The furthest page worth serving; matches discovery's own ceiling. */
export const MAX_PAGE = 500;

/**
 * Reads ?page= without trusting it.
 *
 * Plain digits only. Number() happily reads "1e3" as 1000 and " 2 " as
 * 2, which means several different URLs ask for the same page — and a
 * crawler that finds one of them has found a new address for a page
 * that already exists. Anything that is not a bare number, or is past
 * the ceiling, is page one.
 */
export function parsePage(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || !/^[0-9]{1,4}$/.test(v)) return 1;
  const n = Number(v);
  return n > 1 && n <= MAX_PAGE ? n : 1;
}
