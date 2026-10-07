import { SITE_HOST } from "@/lib/url";

/**
 * The site's own domains.
 *
 * A visitor referred by our own search page is browsing the
 * marketplace, not arriving from a channel — without this they would be
 * filed under "other" and a business would think an unknown channel was
 * working for them.
 *
 * Derived from SITE_HOST so there is one place the site is named, plus
 * the hosts a developer actually runs it on.
 */
export const OWN_HOSTS: readonly string[] = [
  SITE_HOST,
  "maw3ed.net",
  "localhost",
  "127.0.0.1",
];
