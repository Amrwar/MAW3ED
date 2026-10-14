/**
 * Where a visit came from, by a link's ?src= — kept apart from visit.ts
 * so it can be tested without the app's network client.
 */

/** The web's SRC_ALIASES (src/lib/attribution/source.ts), by value; visit.test.ts keeps them equal. */
export const SOURCES: Record<string, string> = {
  instagram: "INSTAGRAM",
  ig: "INSTAGRAM",
  insta: "INSTAGRAM",
  whatsapp: "WHATSAPP",
  wa: "WHATSAPP",
  wapp: "WHATSAPP",
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  messenger: "FACEBOOK",
  google: "GOOGLE",
  gbp: "GOOGLE",
  gmb: "GOOGLE",
  maps: "GOOGLE",
  website: "WEBSITE",
  site: "WEBSITE",
  web: "WEBSITE",
  qr: "QR",
  print: "QR",
  card: "QR",
  maw3ed: "MAW3ED",
  internal: "MAW3ED",
  direct: "DIRECT",
};

export function sourceOf(src: string | null | undefined): string {
  const key = src?.trim().toLowerCase();
  if (!key) return "MAW3ED";
  return SOURCES[key] ?? "OTHER";
}

