import type { Lang } from "@/lib/i18n";
import { hasTwin, localizePath, splitLang } from "@/lib/locale-path";

/**
 * What the proxy does with a request's language. Pure, so it can be
 * tested without a server; src/proxy.ts carries it out.
 *
 *   redirect  send the browser to `to` (and remember `remember`, if set)
 *   rewrite   serve the bare page at `to`, in `lang`
 *   next      serve the request as it is, in `lang`
 *
 * The rules, in order:
 *
 *   /ar/x            → /x. Arabic has no prefix; /ar is accepted so a
 *                      hand-typed or guessed link still lands.
 *   /en/x, x single  → /x, remembering English. The dashboard and the
 *                      like have one address each.
 *   ?lang=en|ar      → the twin, without the parameter. Store listings
 *                      already link to /privacy?lang=en.
 *   /x, cookie = en  → /en/x, for a person who chose English and then
 *                      followed a bare link. Reads only; a form post
 *                      is never redirected.
 *   /en/x            → rewritten to /x, in English. Remembered only
 *                      when nothing is saved yet: one English link
 *                      opened by somebody who chose Arabic must not
 *                      turn every later bare link into English.
 *   /x               → Arabic for a public page, the saved choice for
 *                      a single-address one (and for posts).
 */
export type LocaleAction =
  | { type: "redirect"; to: string; remember?: Lang }
  | { type: "rewrite"; to: string; lang: Lang; remember?: Lang }
  | { type: "next"; lang: Lang };

export function routeLocale({
  pathname,
  search,
  method,
  cookieLang,
}: {
  pathname: string;
  /** The query string, with its "?" or empty. */
  search: string;
  method: string;
  /** The saved choice: the maw3ed-lang cookie's value, if any. */
  cookieLang: string | undefined;
}): LocaleAction {
  // "//host/x" is a path to Next but a whole other site to new URL():
  // never build a redirect from one.
  if (pathname.startsWith("//") || splitLang(pathname).path.startsWith("//")) {
    return { type: "next", lang: cookieLang === "en" ? "en" : "ar" };
  }
  const saved: Lang = cookieLang === "en" ? "en" : "ar";
  const read = method === "GET" || method === "HEAD";
  const { lang: urlLang, path } = splitLang(pathname);
  const twin = hasTwin(path);

  if (urlLang === "ar") return { type: "redirect", to: path + search, remember: "ar" };
  if (urlLang === "en" && !twin) return { type: "redirect", to: path + search, remember: "en" };

  if (read && twin) {
    const params = new URLSearchParams(search);
    const asked = params.get("lang");
    if (asked === "en" || asked === "ar") {
      params.delete("lang");
      const rest = params.size ? `?${params}` : "";
      return { type: "redirect", to: localizePath(path, asked) + rest, remember: asked };
    }
    if (urlLang === null && saved === "en") {
      return { type: "redirect", to: localizePath(path, "en") + search };
    }
  }

  if (urlLang === "en") {
    return { type: "rewrite", to: path + search, lang: "en", ...(cookieLang === undefined ? { remember: "en" as const } : {}) };
  }
  return { type: "next", lang: twin && read ? "ar" : saved };
}
