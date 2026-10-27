import { cookies, headers } from "next/headers";
import type { Lang } from "@/lib/i18n";
import { LANG_COOKIE, LANG_HEADER } from "@/lib/lang";

export { LANG_COOKIE };

/**
 * The language this request is served in.
 *
 * The proxy decides it (lib/locale-routing): from the address for a
 * public page, /en/x being English and /x Arabic, and from the saved
 * choice for a signed-in area that has one address. The cookie is read
 * directly only where the proxy did not run.
 *
 * Deliberately not Accept-Language. Whatever a crawler is served at an
 * address is what that address is indexed as, and Arabic is the
 * product's language; English has its own addresses for search to find.
 */
export async function getLang(): Promise<Lang> {
  const resolved = (await headers()).get(LANG_HEADER);
  if (resolved === "en" || resolved === "ar") return resolved;
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return value === "en" ? "en" : "ar";
}
