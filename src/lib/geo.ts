import type { GeoPoint } from "@/lib/types";

/**
 * Coordinate order is the single most dangerous thing in this codebase.
 *
 *   GeoJSON / MongoDB : [longitude, latitude]
 *   Leaflet / browser : [latitude, longitude]
 *
 * They are reversed, and swapping them does not throw — it silently puts a
 * report on the other side of the planet. Every conversion goes through these
 * two functions and nowhere else.
 */

export type LatLng = { lat: number; lng: number };

export function toGeoJSON({ lat, lng }: LatLng): GeoPoint {
  return { type: "Point", coordinates: [lng, lat] };
}

export function toLeaflet(point: GeoPoint): LatLng {
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}

export function isValidLatLng({ lat, lng }: LatLng): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

const EARTH_RADIUS_M = 6_371_008.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in metres. Used only on the client, for sorting a
 * crew's task list by distance from their live GPS position — server-side
 * proximity is answered by MongoDB's 2dsphere index instead.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Buckets a point into a fixed grid cell, for heatmap aggregation and the
 * bin-placement analysis in Phase 6. ~0.0009 degrees is roughly 100 m.
 */
export function gridCell({ lat, lng }: LatLng, size = 0.0009): string {
  const row = Math.floor(lat / size);
  const col = Math.floor(lng / size);
  return `${row}:${col}`;
}
