import proj4 from "proj4";
import type { Place } from "../../lib/places/schema";

// ETRS89 / UTM zone 33N, the coordinate system of the Berlin LoD2 data.
proj4.defs(
  "EPSG:25833",
  "+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
);

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export function wgsToUtm(lat: number, lon: number): Vec2 {
  return proj4("EPSG:4326", "EPSG:25833", [lon, lat]) as Vec2;
}

export function utmToWgs(east: number, north: number): { lat: number; lon: number } {
  const [lon, lat] = proj4("EPSG:25833", "EPSG:4326", [east, north]);
  return { lat, lon };
}

/**
 * Local scene frame: meters, origin at the place center, +X east, +Z south,
 * +Y up (three.js is right-handed, so north has to be -Z).
 */
export interface Frame {
  east: number;
  north: number;
}

export function frameFor(place: Pick<Place, "center">): Frame {
  const [east, north] = wgsToUtm(place.center.lat, place.center.lon);
  return { east, north };
}

export function utmToLocal(frame: Frame, east: number, north: number): Vec2 {
  return [east - frame.east, frame.north - north];
}

export function wgsToLocal(frame: Frame, lat: number, lon: number): Vec2 {
  const [east, north] = wgsToUtm(lat, lon);
  return utmToLocal(frame, east, north);
}

export function localToWgs(frame: Frame, x: number, z: number) {
  return utmToWgs(frame.east + x, frame.north - z);
}

/** Total half extent of generated scenery: walkable area plus backdrop ring. */
export function extentOf(place: Pick<Place, "halfSize" | "backdrop">): number {
  return place.halfSize + place.backdrop;
}

/** WGS84 bounding box around the place, grown by `margin` meters. */
export function wgsBounds(place: Pick<Place, "center" | "halfSize" | "backdrop">, margin = 0) {
  const frame = frameFor(place);
  const reach = extentOf(place) + margin;
  const corners = [
    localToWgs(frame, -reach, -reach),
    localToWgs(frame, reach, -reach),
    localToWgs(frame, -reach, reach),
    localToWgs(frame, reach, reach),
  ];
  return {
    south: Math.min(...corners.map((c) => c.lat)),
    north: Math.max(...corners.map((c) => c.lat)),
    west: Math.min(...corners.map((c) => c.lon)),
    east: Math.max(...corners.map((c) => c.lon)),
  };
}

/** Stable 32-bit string hash (FNV-1a), used for per-building color choices. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pointInPolygon(x: number, z: number, ring: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceToSegment(px: number, pz: number, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / lengthSquared));
  return Math.hypot(px - (a[0] + t * dx), pz - (a[1] + t * dz));
}
