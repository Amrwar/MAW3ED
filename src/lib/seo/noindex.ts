/**
 * A test server (docs/staging.md) is public, but nothing on it is real,
 * so no search engine may list it. Set SITE_NOINDEX=1 there; production
 * never sets it.
 *
 * How it keeps pages out: every response says `X-Robots-Tag: noindex`
 * (next.config.ts), the root layout's robots metadata says noindex, and
 * the sitemap is empty. robots.txt still lets crawlers in, on purpose: a
 * crawler that may not fetch a page never reads its noindex, and can list
 * the bare URL from links alone. Where a page sets its own robots
 * metadata, the header still says noindex, and engines obey the most
 * restrictive signal.
 */
export function siteNoindex(): boolean {
  return process.env.SITE_NOINDEX === "1";
}
