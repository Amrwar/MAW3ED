import type { Business } from "@/types/api";

/**
 * The map half of the results' list/map switch.
 *
 * A business is on the map only where its owner pinned it — its own pin
 * and each active branch's. Nothing is placed from an address or a
 * city's centre; a business without a pin is simply not on the map.
 */

export type ResultsMode = "list" | "map";

export interface MapPoint {
  /** Unique per pin: a business with branches has several. */
  key: string;
  id: string;
  slug: string;
  lat: number;
  lng: number;
  branchId: string | null;
  branchNameAr: string | null;
  branchNameEn: string | null;
}

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

export function pinsOf(b: Pick<Business, "id" | "slug" | "pins">): MapPoint[] {
  const valid_ = (b.pins ?? []).filter((p) => valid(p.lat, p.lng));
  // A branch pinned exactly where the business is would draw two markers
  // on one spot; the branch, which names itself, is kept.
  const atBranch = new Set(valid_.filter((p) => p.branchId).map((p) => `${p.lat},${p.lng}`));
  return valid_
    .filter((p) => p.branchId !== null || !atBranch.has(`${p.lat},${p.lng}`))
    .map((p) => ({
      key: `${b.id}:${p.branchId ?? "main"}`,
      id: b.id,
      slug: b.slug,
      lat: p.lat,
      lng: p.lng,
      branchId: p.branchId,
      branchNameAr: p.branchNameAr,
      branchNameEn: p.branchNameEn,
    }));
}

export function mapPoints(list: Pick<Business, "id" | "slug" | "pins">[]): MapPoint[] {
  return list.flatMap(pinsOf);
}

/** The smallest region showing every point, with a margin; null with none. */
export function regionFor(points: { lat: number; lng: number }[], around?: { lat: number; lng: number } | null) {
  const all = around ? [...points, around] : points;
  if (all.length === 0) return null;
  const lats = all.map((p) => p.lat);
  const lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
  };
}
