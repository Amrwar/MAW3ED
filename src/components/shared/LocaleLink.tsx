"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { localizePath } from "@/lib/locale-path";

/**
 * next/link, pointed at the address of the page in the language being
 * read: /faq from an English page goes to /en/faq. Without it the proxy
 * would still get there, but by a redirect on every click.
 *
 * Paths with no English twin (the dashboard, the API) and other sites
 * pass through untouched (lib/locale-path).
 */
export default function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const lang = useLang();
  const to =
    typeof href === "string"
      ? localizePath(href, lang)
      : typeof href.pathname === "string"
        ? { ...href, pathname: localizePath(href.pathname, lang) }
        : href;
  return <NextLink href={to} {...props} />;
}
