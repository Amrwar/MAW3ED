/**
 * An uploaded image at the size it is shown, in the lightest format the
 * browser accepts.
 *
 * Uploads are stored on Cloudinary as the owner sent them: a 2 MB
 * phone photo or a print-size PNG flyer. Cloudinary transforms on the
 * fly from the URL, so asking for `f_auto,q_auto,w_640` returns WebP or
 * AVIF at 640 px instead, cached at its CDN. `c_limit` never enlarges
 * an image smaller than that.
 *
 * Anything that is not a Cloudinary upload URL comes back unchanged,
 * and so does a URL that already carries a transformation.
 */
export function cdnImage(url: string, width: number): string;
export function cdnImage(url: string | null | undefined, width: number): string | null | undefined;
export function cdnImage(url: string | null | undefined, width: number) {
  return url && transform(url, `f_auto,q_auto,c_limit,w_${Math.round(width)}`);
}

/**
 * An uploaded image as a link preview: exactly 1200 × 630, cropped
 * around its subject, as a JPEG. The size is what the og:image tag
 * declares, and JPEG because not every app that unfurls links (some
 * WhatsApp versions among them) reads WebP.
 */
export function cdnShareImage(url: string): string {
  return transform(url, "f_jpg,q_auto,c_fill,g_auto,w_1200,h_630");
}

function transform(url: string, params: string): string {
  const marker = "/image/upload/";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== "res.cloudinary.com") return url;
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return url;

  const rest = parsed.pathname.slice(at + marker.length);
  // The first segment after /upload/ is either a version (v123…), the
  // public id, or a transformation already set by somebody else.
  const first = rest.split("/", 1)[0];
  if (/(^|,)[a-z]{1,3}_/.test(first)) return url;

  parsed.pathname = `${parsed.pathname.slice(0, at + marker.length)}${params}/${rest}`;
  return parsed.toString();
}
