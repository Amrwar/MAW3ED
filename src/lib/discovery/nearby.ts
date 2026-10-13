import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { boundingBox, type LatLng } from "@/lib/geo";
import type { DiscoveryQuery } from "./params";
import { cardsForIds, type DiscoveryBusiness } from "./search";

/**
 * Places near a point, nearest first.
 *
 * In the database, not on the phone: the app sends where it is and gets
 * back a page of the closest — never the catalogue to sort itself. A
 * bounding box on the indexed coordinates narrows the rows before any
 * distance is computed; the distance is great-circle (haversine), over a
 * business's own pin and every active branch's, and a business counts as
 * near as its nearest location.
 *
 * Only businesses with a pin their owner set can appear. Nothing is
 * placed from an address.
 */

export const MAX_RADIUS_KM = 50;
export const DEFAULT_RADIUS_KM = 10;
const CANDIDATES = 200;

export interface NearbyBusiness extends DiscoveryBusiness {
  distanceKm: number;
  /** The location that made it near: its own pin or a branch's. */
  nearest: { lat: number; lng: number; branchId: string | null };
}

interface Hit {
  businessId: string;
  branchId: string | null;
  lat: number;
  lng: number;
  km: number;
}

export async function findNearby(
  center: LatLng,
  opts: { radiusKm?: number; limit?: number; query: DiscoveryQuery },
  now: Date = new Date(),
): Promise<{ businesses: NearbyBusiness[]; radiusKm: number }> {
  const radiusKm = Math.min(Math.max(opts.radiusKm ?? DEFAULT_RADIUS_KM, 0.5), MAX_RADIUS_KM);
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 50);
  const box = boundingBox(center, radiusKm);

  const hits = await db.$queryRaw<Hit[]>(Prisma.sql`
    WITH pts AS (
      SELECT b."id" AS "businessId", NULL::text AS "branchId", b."latitude" AS lat, b."longitude" AS lng
      FROM "Business" b
      WHERE b."isPublished" = true
        AND b."latitude" BETWEEN ${box.minLat} AND ${box.maxLat}
        AND b."longitude" BETWEEN ${box.minLng} AND ${box.maxLng}
      UNION ALL
      SELECT br."businessId", br."id", br."latitude", br."longitude"
      FROM "Branch" br
      JOIN "Business" b ON b."id" = br."businessId"
      WHERE b."isPublished" = true AND br."isActive" = true
        AND br."latitude" BETWEEN ${box.minLat} AND ${box.maxLat}
        AND br."longitude" BETWEEN ${box.minLng} AND ${box.maxLng}
    ),
    measured AS (
      SELECT "businessId", "branchId", lat, lng,
        6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(lat - ${center.lat}) / 2), 2) +
          cos(radians(${center.lat})) * cos(radians(lat)) * power(sin(radians(lng - ${center.lng}) / 2), 2)
        ))) AS km
      FROM pts
    ),
    nearest AS (
      SELECT DISTINCT ON ("businessId") "businessId", "branchId", lat, lng, km
      FROM measured
      WHERE km <= ${radiusKm}
      ORDER BY "businessId", km
    )
    SELECT * FROM nearest ORDER BY km LIMIT ${CANDIDATES}
  `);

  const byId = new Map(hits.map((h) => [h.businessId, h]));
  const cards = await cardsForIds([...byId.keys()], opts.query, now);

  const businesses = cards
    .map((c) => {
      const h = byId.get(c.id) as Hit;
      return {
        ...c,
        distanceKm: Math.round(Number(h.km) * 100) / 100,
        nearest: { lat: Number(h.lat), lng: Number(h.lng), branchId: h.branchId },
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);

  return { businesses, radiusKm };
}
