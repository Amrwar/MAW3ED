import type { Lang } from "@/lib/i18n";

/**
 * Which language a URL is in.
 *
 * Arabic, the product's language, lives at the bare path: /businesses.
 * English lives under /en: /en/businesses. Each page therefore has one
 * address per language, which is what lets a search engine index both
 * and lets hreflang point each version at its twin (lib/seo/meta).
 *
 * Only public pages have twins. Signed-in areas (the dashboard, the
 * customer account, admin) and machinery (the API, payment returns,
 * one-off links) exist once and follow the visitor's saved choice, the
 * maw3ed-lang cookie, as the whole site did before. The proxy
 * (src/proxy.ts) sends /en/dashboard to /dashboard and so on.
 *
 * Pure: the proxy, server components and client components all use it.
 */

export const EN_PREFIX = "/en";

/** Sections with one address, in whichever language the visitor chose. */
const SINGLE_ADDRESS = [
  "/api",
  "/_next",
  "/.well-known",
  "/dashboard",
  "/admin",
  "/account",
  "/onboarding",
  "/notifications",
  "/payment",
  "/booking",
  "/verify-email",
  "/ref",
];

function under(path: string, section: string): boolean {
  return path === section || path.startsWith(`${section}/`);
}

/**
 * Whether a path (no query) is a public page with an English twin.
 * Files (sitemap.xml, robots.txt, og.png) are not pages.
 */
export function hasTwin(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (SINGLE_ADDRESS.some((s) => under(path, s))) return false;
  const last = path.slice(path.lastIndexOf("/") + 1);
  return !last.includes(".");
}

/**
 * Splits the language prefix off a pathname. `lang` is null when the
 * path carries none; /ar is recognised so it can be sent to the bare
 * path rather than read as a city called "ar".
 */
export function splitLang(pathname: string): { lang: Lang | null; path: string } {
  for (const lang of ["en", "ar"] as const) {
    const prefix = `/${lang}`;
    if (pathname === prefix) return { lang, path: "/" };
    if (pathname.startsWith(`${prefix}/`)) return { lang, path: pathname.slice(prefix.length) };
  }
  return { lang: null, path: pathname };
}

/**
 * The address of `href` in `lang`. Leaves alone anything that is not a
 * site path (external links, #anchors, mailto:), anything without a
 * twin, and anything already carrying a language.
 */
export function localizePath(href: string, lang: Lang): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const cut = href.search(/[?#]/);
  const path = cut === -1 ? href : href.slice(0, cut);
  const rest = cut === -1 ? "" : href.slice(cut);
  if (splitLang(path).lang !== null || !hasTwin(path)) return href;
  if (lang === "ar") return href;
  return (path === "/" ? EN_PREFIX : `${EN_PREFIX}${path}`) + rest;
}
