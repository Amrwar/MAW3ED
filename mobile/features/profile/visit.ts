import { api } from "@/lib/api/client";
import { sourceOf } from "./visit-source";

/**
 * Count a visit to a business page, by where it came from — the same
 * counter the website keeps (POST /api/public/[slug]/view): one integer
 * per business, source and day, nothing about the visitor.
 *
 * A link's `src` (a QR code, an Instagram bio link) names the source;
 * opened from inside the app, it is Maw3ed's own discovery. Without
 * this, a QR code scanned on a phone with the app installed would open
 * the app and never be counted.
 */

/** Fire and forget: a counter must never break the page. */
export function countVisit(slug: string, src: string | null | undefined) {
  void api
    .post(`/api/public/${encodeURIComponent(slug)}/view`, { source: sourceOf(src) }, { anonymous: true })
    .catch(() => undefined);
}
