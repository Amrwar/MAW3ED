import type { Metadata } from "next";
import { localizePath } from "@/lib/locale-path";
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
 * Every public page has an address per language — /x in Arabic, /en/x
 * in English (lib/locale-path) — so each names itself as canonical and
 * lists both twins as hreflang alternates, with Arabic as x-default:
 * the version for a searcher whose language is neither.
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
  /** The language the page is being served in. Arabic when omitted. */
  lang?: "ar" | "en";
}

/** The metadata of a page that turned out not to exist: never indexed. */
export function notFoundMetadata(lang: "ar" | "en"): Metadata {
  return { title: lang === "en" ? "Not found" : "غير موجود", robots: { index: false, follow: false } };
}

/** The site-wide share card (public/og.png), for pages without an image of their own. */
export const DEFAULT_OG_IMAGE = { url: "/og.png", size: { width: 1200, height: 630 } } as const;

/** og:locale for a page language. */
export function ogLocale(lang: "ar" | "en"): string {
  return lang === "en" ? "en_US" : "ar_EG";
}

/** The page's path, with ?page= only past page one. */
function pagePath(path: string, page: number): string {
  const clean = path.split("?")[0];
  // Page one is the page. Only a later page carries the parameter, and
  // it carries nothing else.
  return page > 1 ? `${clean}?page=${page}` : clean;
}

export function canonicalFor(path: string, page = 1, lang: "ar" | "en" = "ar"): string {
  return siteUrl(localizePath(pagePath(path, page), lang));
}

/**
 * A page's canonical and its hreflang twins. `path` is the page's
 * Arabic (bare) path, with the query when the query is part of what
 * identifies the page.
 */
export function alternatesFor(path: string, lang: "ar" | "en"): NonNullable<Metadata["alternates"]> {
  const ar = siteUrl(path);
  const en = siteUrl(localizePath(path, "en"));
  return {
    canonical: lang === "en" ? en : ar,
    languages: { ar, en, "x-default": ar },
  };
}

export function buildMetadata({
  title,
  description,
  path,
  page = 1,
  image,
  lang = "ar",
}: PageMeta): Metadata {
  const canonical = canonicalFor(path, page, lang);
  const pagedTitle = page > 1 ? `${title} — ${lang === "en" ? "Page" : "صفحة"} ${page}` : title;

  return {
    title: pagedTitle,
    description,
    alternates: alternatesFor(pagePath(path, page), lang),
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
      siteName: "موعد · Maw3ed",
      // The language the page is actually in. It said ar_EG over English
      // titles, so a share card and the page disagreed.
      locale: ogLocale(lang),
      type: "website",
      // The brand card when the page has no picture of its own: a page
      // object's openGraph replaces the layout's whole, image included.
      images: [{ url: image ?? DEFAULT_OG_IMAGE.url, ...(image ? {} : DEFAULT_OG_IMAGE.size) }],
    },
    twitter: {
      card: "summary_large_image",
      images: [image ?? DEFAULT_OG_IMAGE.url],
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
