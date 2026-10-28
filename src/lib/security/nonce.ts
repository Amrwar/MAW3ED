import { headers } from "next/headers";

/**
 * This request's CSP nonce, as the proxy (src/proxy.ts) set it.
 *
 * Next stamps the nonce onto the script tags it injects itself, but a
 * <script type="application/ld+json"> written by a page is ours to
 * mark. CSP applies to those tags like any other script element, so an
 * unnonced one is dropped — and because nothing visible depends on it,
 * the only symptom would be structured data quietly disappearing from
 * search results weeks later.
 *
 * Returns undefined rather than throwing when there is no nonce. React
 * omits a nonce={undefined} attribute entirely, which is what should
 * happen on a response that no policy covers.
 */
export async function requestNonce(): Promise<string | undefined> {
  return (await headers()).get("x-nonce") ?? undefined;
}
