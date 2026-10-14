import { PixelRatio } from "react-native";

/**
 * An image URL for the size it is shown at.
 *
 * Uploads live on Cloudinary and the seed data on Unsplash; both resize
 * on request. Measured on the home screen: eight images, 974 KB, for
 * cards a third of a phone wide — originals of 1200–1600 px. Asking for
 * the shown width (in device pixels) cuts that by most of it, and lets
 * the server pick the best format the device takes.
 *
 * Widths are rounded up to a few steps so the same picture shown at
 * slightly different sizes is one cached file, not five. Any other host
 * is returned unchanged — never a guessed transformation that breaks it.
 */

const STEPS = [64, 128, 256, 384, 512, 768, 1024, 1280, 1600];

/** Device pixels for `points`, rounded up to a step. */
export function stepFor(points: number, scale: number): number {
  const px = Math.ceil(points * Math.min(scale, 3));
  return STEPS.find((s) => s >= px) ?? STEPS[STEPS.length - 1]!;
}

export function sizedFor(uri: string, width: number): string {
  try {
    const url = new URL(uri);
    if (url.hostname === "res.cloudinary.com") {
      // /<cloud>/image/upload/<transformations?>/<version?>/<id>: add ours
      // straight after /upload/, unless the URL already carries one.
      const at = url.pathname.indexOf("/upload/");
      if (at < 0) return uri;
      const rest = url.pathname.slice(at + "/upload/".length);
      if (/^[a-z]{1,3}_[^/]*\//.test(rest)) return uri;
      url.pathname = `${url.pathname.slice(0, at)}/upload/f_auto,q_auto,c_limit,w_${width}/${rest}`;
      return url.toString();
    }
    if (url.hostname === "images.unsplash.com") {
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", "70");
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", "max");
      return url.toString();
    }
    return uri;
  } catch {
    return uri;
  }
}

/** `uri`, sized for something `points` wide on this device. */
export function sized(uri: string, points: number): string {
  return sizedFor(uri, stepFor(points, PixelRatio.get()));
}
