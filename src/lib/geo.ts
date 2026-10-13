/**
 * Coordinates, read and measured.
 *
 * Owners do not type latitudes; they copy a link from Google Maps. So a
 * location is accepted as any of the shapes those links take, or as a
 * plain "30.0444, 31.2357", and refused if it is anything else — never
 * guessed from an address. Nothing in Maw3ed invents a coordinate.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export function validLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    // 0,0 is in the Atlantic; it is what a blank form produces, not a place.
    !(lat === 0 && lng === 0)
  );
}

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";

/**
 * A pasted location, or null when it holds no coordinates.
 *
 * Understands, in order of how precise they are:
 *   …!3d30.0444!4d31.2357…     the place's own pin, in a full maps URL
 *   …@30.0444,31.2357,17z…     the map's centre
 *   …?q=30.0444,31.2357 / ll= / query= / destination=
 *   30.0444, 31.2357           typed or copied from the pin
 *
 * A short maps.app.goo.gl link holds no coordinates until it is opened,
 * so it is refused with a hint rather than resolved by fetching it.
 */
export function parseLocation(input: string): LatLng | null {
  const raw = input.trim();
  if (!raw) return null;
  const decoded = safeDecode(raw);

  const patterns = [
    new RegExp(`!3d${NUM}!4d${NUM}`),
    new RegExp(`@${NUM},${NUM}`),
    new RegExp(`[?&](?:q|ll|query|destination|center)=${NUM},\\s*${NUM}`),
    new RegExp(`^${NUM}\\s*[,،]\\s*${NUM}$`),
  ];
  for (const re of patterns) {
    const m = re.exec(decoded);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (validLatLng(lat, lng)) return { lat: round(lat), lng: round(lng) };
  }
  return null;
}

/** A short link that has to be opened before it says where it points. */
export function isShortMapsLink(input: string): boolean {
  return /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(input.trim());
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The box around a point that holds every place within `km` — the cheap filter before distances. */
export function boundingBox(center: LatLng, km: number): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const dLat = km / 111.32;
  const cos = Math.cos(rad(center.lat));
  const dLng = cos < 1e-6 ? 180 : Math.min(180, km / (111.32 * cos));
  return { minLat: center.lat - dLat, maxLat: center.lat + dLat, minLng: center.lng - dLng, maxLng: center.lng + dLng };
}

export function mapsUrl(p: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

function rad(d: number) {
  return (d * Math.PI) / 180;
}

/** Six decimals is about 11 cm — more is noise from the map, not precision. */
function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
