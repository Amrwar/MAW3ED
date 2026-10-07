import type { TrafficSource } from "@prisma/client";

/**
 * Working out where a visitor came from.
 *
 * Two signals, in order of trust:
 *
 *   1. The `src` parameter on the link. The business put it there, so
 *      it says what the business meant — a card handed out in the shop
 *      carries src=qr whatever browser opens it.
 *   2. The referring host, when there is no parameter. Instagram and
 *      Facebook strip referrers often enough that this is a fallback
 *      and not the primary, which is exactly why the links exist.
 *
 * Anything unrecognised is OTHER, never dropped and never guessed into
 * a channel it might not be. A visitor with neither signal is DIRECT,
 * which is the honest name for "we do not know".
 */

/** What a business may put in ?src= — the spellings people actually use. */
const SRC_ALIASES: Record<string, TrafficSource> = {
  // Instagram
  instagram: "INSTAGRAM",
  ig: "INSTAGRAM",
  insta: "INSTAGRAM",
  // WhatsApp
  whatsapp: "WHATSAPP",
  wa: "WHATSAPP",
  wapp: "WHATSAPP",
  // Facebook
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  messenger: "FACEBOOK",
  // Google, including the Business Profile link
  google: "GOOGLE",
  gbp: "GOOGLE",
  gmb: "GOOGLE",
  maps: "GOOGLE",
  // The business's own site
  website: "WEBSITE",
  site: "WEBSITE",
  web: "WEBSITE",
  // Printed
  qr: "QR",
  print: "QR",
  card: "QR",
  // Inside the marketplace
  maw3ed: "MAW3ED",
  internal: "MAW3ED",
  direct: "DIRECT",
};

/** Referring hosts, for when the link carried no parameter. */
const HOST_PATTERNS: [RegExp, TrafficSource][] = [
  [/(^|\.)instagram\.com$/i, "INSTAGRAM"],
  [/(^|\.)l\.instagram\.com$/i, "INSTAGRAM"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/i, "WHATSAPP"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|lm\.facebook\.com)$/i, "FACEBOOK"],
  [/(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i, "GOOGLE"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/i, "OTHER"],
  [/(^|\.)(tiktok\.com)$/i, "OTHER"],
];

/** Every channel a business can be given a link for, in menu order. */
export const LINKABLE_SOURCES = [
  "INSTAGRAM",
  "WHATSAPP",
  "FACEBOOK",
  "GOOGLE",
  "WEBSITE",
  "QR",
] as const satisfies readonly TrafficSource[];

export type LinkableSource = (typeof LINKABLE_SOURCES)[number];

/** The canonical `?src=` value for a channel. */
export const SRC_PARAM: Record<LinkableSource, string> = {
  INSTAGRAM: "instagram",
  WHATSAPP: "whatsapp",
  FACEBOOK: "facebook",
  GOOGLE: "google",
  WEBSITE: "website",
  QR: "qr",
};

export const SOURCE_LABELS: Record<TrafficSource, { ar: string; en: string }> = {
  DIRECT: { ar: "مباشر", en: "Direct" },
  INSTAGRAM: { ar: "إنستجرام", en: "Instagram" },
  WHATSAPP: { ar: "واتساب", en: "WhatsApp" },
  FACEBOOK: { ar: "فيسبوك", en: "Facebook" },
  GOOGLE: { ar: "جوجل", en: "Google" },
  WEBSITE: { ar: "موقعك", en: "Your website" },
  QR: { ar: "كود QR", en: "QR code" },
  MAW3ED: { ar: "من داخل موعد", en: "Inside Maw3ed" },
  OTHER: { ar: "مصادر أخرى", en: "Other" },
};

/**
 * Read the `src` parameter.
 *
 * Case and surrounding space are forgiven because these end up typed
 * into link builders by hand. Something present but unrecognised is
 * OTHER — it is a real visit from somewhere, and silently calling it
 * DIRECT would credit the wrong channel.
 */
export function sourceFromParam(raw: string | null | undefined): TrafficSource | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return SRC_ALIASES[key] ?? "OTHER";
}

/** Read the referring host, when the link said nothing. */
export function sourceFromReferrer(referrer: string | null | undefined): TrafficSource | null {
  if (!referrer) return null;

  let host: string;
  try {
    host = new URL(referrer).hostname;
  } catch {
    return null;
  }

  for (const [pattern, source] of HOST_PATTERNS) {
    if (pattern.test(host)) return source;
  }
  return null;
}

/**
 * The whole decision, in one place.
 *
 * `ownHosts` are the site's own domains: a visit referred by our own
 * search page is MAW3ED, not OTHER, and certainly not a channel the
 * business is paying for.
 */
export function resolveSource(params: {
  src?: string | null;
  referrer?: string | null;
  ownHosts?: readonly string[];
}): TrafficSource {
  const fromParam = sourceFromParam(params.src);
  if (fromParam) return fromParam;

  if (params.referrer) {
    try {
      const host = new URL(params.referrer).hostname.toLowerCase();
      const own = params.ownHosts ?? [];
      if (own.some((h) => host === h || host.endsWith(`.${h}`))) return "MAW3ED";
    } catch {
      // Unparseable referrer; fall through to the host patterns, which
      // will also fail, and then to DIRECT.
    }
  }

  return sourceFromReferrer(params.referrer) ?? "DIRECT";
}

/** The link a business hands out for one channel. */
export function bookingLinkFor(
  baseUrl: string,
  slug: string,
  source: LinkableSource,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/company/${slug}?src=${SRC_PARAM[source]}`;
}
