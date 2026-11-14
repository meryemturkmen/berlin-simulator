/**
 * Builds the stylized Berlin map: district outlines as simplified SVG paths.
 * Source: Geoportal Berlin, "ALKIS Berlin Bezirke" (WFS), dl-de/zero-2-0.
 * Output: public/assets/map/berlin.json
 * Usage: tsx scripts/build_map.ts [--force]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BerlinMap } from "../lib/places/map";
import { wgsToUtm, type Vec2 } from "./lib/geo";
import {
  ASSET_DIR,
  RAW_DIR,
  download,
  ensureDir,
  hasFlag,
  loadPlaces,
  log,
  runMain,
} from "./lib/io";

const WFS =
  "https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=alkis_bezirke:bezirksgrenzen&outputFormat=application/json&srsName=EPSG:4326";
/** Simplification tolerance in meters: plenty for a map a few hundred pixels wide. */
const TOLERANCE = 90;
/** Map units per meter (1 unit = 100 m keeps path strings short). */
const SCALE = 0.01;

interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

/** Ramer-Douglas-Peucker line simplification. */
export function simplify(points: Vec2[], tolerance: number): Vec2[] {
  if (points.length <= 2) return points;
  let worst = 0;
  let index = 0;
  const [a, b] = [points[0], points[points.length - 1]];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const distance =
      Math.abs((b[0] - a[0]) * (a[1] - points[i][1]) - (a[0] - points[i][0]) * (b[1] - a[1])) /
      length;
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }
  if (worst <= tolerance) return [a, b];
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

/** Simplifies a closed ring by splitting it at the vertex farthest from its start. */
export function simplifyRing(ring: Vec2[], tolerance: number): Vec2[] {
  let far = 0;
  let farDistance = 0;
  ring.forEach((point, index) => {
    const distance = Math.hypot(point[0] - ring[0][0], point[1] - ring[0][1]);
    if (distance > farDistance) {
      farDistance = distance;
      far = index;
    }
  });
  const first = simplify(ring.slice(0, far + 1), tolerance);
  const second = simplify([...ring.slice(far), ring[0]], tolerance);
  return [...first.slice(0, -1), ...second.slice(0, -1)];
}

export async function buildMap(force = false): Promise<void> {
  const rawFile = join(ensureDir(join(RAW_DIR, "map")), "bezirke.geojson");
  if (force || !existsSync(rawFile)) {
    log("map", "downloading district boundaries");
    writeFileSync(rawFile, await (await download(WFS, 180_000)).text());
  }
  const features = (JSON.parse(readFileSync(rawFile, "utf8")) as { features: Feature[] }).features;

  // Project to UTM, then to a compact frame with the origin at the top-left.
  const districts = features.map((feature) => {
    const polygons = (
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates
    ) as number[][][][];
    const rings = polygons.map((polygon) => polygon[0].map(([lon, lat]) => wgsToUtm(lat, lon)));
    const name = String(
      feature.properties.namgem ?? feature.properties.name ?? feature.properties.nam ?? "",
    );
    return { name, rings };
  });
  const all = districts.flatMap((district) => district.rings.flat());
  const minE = Math.min(...all.map((point) => point[0]));
  const maxE = Math.max(...all.map((point) => point[0]));
  const minN = Math.min(...all.map((point) => point[1]));
  const maxN = Math.max(...all.map((point) => point[1]));
  const toMap = ([east, north]: Vec2): Vec2 => [(east - minE) * SCALE, (maxN - north) * SCALE];

  const map: BerlinMap = {
    width: Math.round((maxE - minE) * SCALE * 10) / 10,
    height: Math.round((maxN - minN) * SCALE * 10) / 10,
    districts: districts
      .map((district) => {
        const rings = district.rings
          // Drop slivers and tiny exclaves that would only be noise at this scale.
          .filter((ring) => ring.length > 20)
          .map((ring) => simplifyRing(ring, TOLERANCE).map(toMap));
        const xs = rings.flat().map((point) => point[0]);
        const ys = rings.flat().map((point) => point[1]);
        return {
          name: district.name,
          path: rings
            .map((ring) => `M${ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}Z`)
            .join(""),
          label: [
            Math.round(((Math.min(...xs) + Math.max(...xs)) / 2) * 10) / 10,
            Math.round(((Math.min(...ys) + Math.max(...ys)) / 2) * 10) / 10,
          ] as [number, number],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    places: loadPlaces().map((place) => {
      const [x, y] = toMap(wgsToUtm(place.center.lat, place.center.lon));
      return { id: place.id, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }),
  };

  const file = join(ensureDir(join(ASSET_DIR, "map")), "berlin.json");
  writeFileSync(file, JSON.stringify(map));
  log(
    "map",
    `${map.districts.length} districts, ${(JSON.stringify(map).length / 1000).toFixed(1)} kB`,
  );
  log("map", map.districts.map((district) => district.name).join(", "));
}

runMain(import.meta.url, () => buildMap(hasFlag("force")));
