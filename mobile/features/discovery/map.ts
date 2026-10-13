import type { Business } from "@/types/api";

/**
 * The map half of the results' list/map switch.
 *
 * Businesses have no coordinates yet — the schema holds a free-text
 * address, a city and a neighbourhood, nothing a map can place — so no
 * business is mappable and Search offers no map. Placing pins at a
 * city's centre would be inventing locations.
 *
 * When the API starts sending `location`, the switch appears by itself:
 * Search shows it as soon as one result can be placed, and a map view
 * receives exactly the results that can.
 */

export type ResultsMode = "list" | "map";

export interface MapPoint {
  id: string;
  slug: string;
  lat: number;
  lng: number;
}

export function mappable(b: Business): MapPoint | null {
  const loc = b.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  if (Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180) return null;
  return { id: b.id, slug: b.slug, lat: loc.lat, lng: loc.lng };
}

export function mapPoints(list: Business[]): MapPoint[] {
  return list.map(mappable).filter((p): p is MapPoint => p !== null);
}
