/**
 * Builds one compact GLB plus a JSON manifest per place:
 *   public/assets/places/<id>.glb   buildings, ground and ground layers
 *   public/assets/places/<id>.json  instance data (trees, benches, lamps), stats
 *
 * Buildings come from Berlin LoD2 (fallback: OSM footprints). Roads, paths,
 * green, water, trees, benches and lamps come from OpenStreetMap.
 * Usage: tsx scripts/build_place.ts [placeId...] [--osm-buildings]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Place, PlaceManifest } from "../lib/places/schema";
import { terrainHeight } from "../lib/places/terrain";
import { seededRandom } from "../lib/random";
import { buildBuildingMesh, loadBuildings } from "./build_buildings";
import { osmFile } from "./fetch_osm";
import type { Building } from "./lib/citygml";
import {
  distanceToSegment,
  extentOf,
  frameFor,
  hashString,
  pointInPolygon,
  type Vec2,
} from "./lib/geo";
import { writeGlb } from "./lib/glb";
import {
  ASSET_DIR,
  RAW_DIR,
  ensureDir,
  hasFlag,
  loadPlaces,
  log,
  placeArgs,
  runMain,
} from "./lib/io";
import {
  MeshBuilder,
  addGroundPolygon,
  addGroundTriangle,
  addRibbon,
  dashPolyline,
  hexToLinear,
  ribbonEdges,
  type GroundOptions,
} from "./lib/mesh";
import { parseOsm, type OsmArea, type OsmData, type OsmWay, type Tags } from "./lib/osm";

const ROAD_WIDTHS: Record<string, number> = {
  motorway: 14,
  trunk: 14,
  primary: 13,
  secondary: 11,
  tertiary: 9,
  unclassified: 6.5,
  residential: 6.5,
  living_street: 5.5,
  service: 3.4,
  busway: 6,
};
const PATH_WIDTHS: Record<string, number> = {
  footway: 2.4,
  path: 2,
  cycleway: 2.4,
  steps: 2.4,
  track: 3,
  bridleway: 2,
};
const LAYER_LIFT = 0.03;
const TERRAIN_CELL = 3;

type GreenKind = "park" | "lawn" | "wood";

function greenKind(tags: Tags): GreenKind | null {
  if (["park", "garden", "dog_park", "common"].includes(tags.leisure)) return "park";
  if (
    ["grass", "meadow", "village_green", "recreation_ground", "flowerbed"].includes(tags.landuse)
  ) {
    return "lawn";
  }
  if (tags.natural === "grassland") return "lawn";
  if (tags.landuse === "forest" || tags.natural === "wood" || tags.natural === "scrub")
    return "wood";
  return null;
}

function isWater(tags: Tags): boolean {
  return (
    tags.natural === "water" ||
    tags.waterway === "riverbank" ||
    tags.waterway === "dock" ||
    tags.landuse === "basin" ||
    tags.landuse === "reservoir"
  );
}

function isSand(tags: Tags): boolean {
  return (
    tags.leisure === "playground" ||
    tags.leisure === "pitch" ||
    tags.natural === "sand" ||
    tags.natural === "beach"
  );
}

function isPlaza(tags: Tags): boolean {
  return (
    ((tags.highway === "pedestrian" || tags.highway === "footway") &&
      (tags.area === "yes" || tags.place === "square")) ||
    tags.place === "square"
  );
}

function numeric(value: string | undefined): number | null {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

interface Line {
  points: Vec2[];
  width: number;
}

function ringArea(ring: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

const CARDINALS: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

/** OSM `direction` (compass degrees or cardinal) -> scene heading (0 faces +Z, i.e. south). */
function headingFromDirection(value: string | undefined): number | null {
  if (!value) return null;
  const degrees =
    value.toUpperCase() in CARDINALS ? CARDINALS[value.toUpperCase()] : Number.parseFloat(value);
  if (!Number.isFinite(degrees)) return null;
  const radians = (degrees * Math.PI) / 180;
  return Math.atan2(Math.sin(radians), -Math.cos(radians));
}

function alongPolyline(
  points: readonly Vec2[],
  spacing: number,
  offset = spacing / 2,
): { point: Vec2; direction: Vec2 }[] {
  const samples: { point: Vec2; direction: Vec2 }[] = [];
  let next = offset;
  let travelled = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length === 0) continue;
    const direction: Vec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    while (next <= travelled + length) {
      const t = next - travelled;
      samples.push({ point: [a[0] + direction[0] * t, a[1] + direction[1] * t], direction });
      next += spacing;
    }
    travelled += length;
  }
  return samples;
}

interface Scene {
  meshes: MeshBuilder[];
  walkways: PlaceManifest["walkways"];
  trees: PlaceManifest["trees"];
  benches: PlaceManifest["benches"];
  lamps: PlaceManifest["lamps"];
  debug: string[];
}

function buildEnvironment(place: Place, osm: OsmData, buildings: Building[]): Scene {
  const reach = extentOf(place);
  const palette = place.palette;
  const hasTerrain = place.terrain.length > 0;
  const height = (x: number, z: number) => terrainHeight(place.terrain, x, z);
  // Only triangles that touch a bump need to follow the terrain closely.
  const needsDetail = (minX: number, maxX: number, minZ: number, maxZ: number) =>
    place.terrain.some(
      (bump) =>
        maxX > bump.x - bump.radius &&
        minX < bump.x + bump.radius &&
        maxZ > bump.z - bump.radius &&
        minZ < bump.z + bump.radius,
    );
  const base: GroundOptions = { reach, height, lift: 0, maxEdge: 0 };
  const layer: GroundOptions = {
    reach,
    height,
    lift: LAYER_LIFT,
    maxEdge: hasTerrain ? TERRAIN_CELL : 0,
    needsDetail,
  };
  const inReach = ([x, z]: Vec2, margin = 0) =>
    Math.abs(x) <= reach - margin && Math.abs(z) <= reach - margin;
  const random = seededRandom(hashString(place.id));
  const debug: string[] = [];
  const svgPath = (ring: readonly Vec2[], close = true) =>
    `M${ring.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join("L")}${close ? "Z" : ""}`;

  // --- Base ground -------------------------------------------------------
  const ground = new MeshBuilder("ground");
  const groundColor = hexToLinear(palette.ground);
  const quad = (x0: number, z0: number, size: number) => {
    addGroundTriangle(ground, [x0, z0], [x0 + size, z0], [x0 + size, z0 + size], groundColor, base);
    addGroundTriangle(ground, [x0, z0], [x0 + size, z0 + size], [x0, z0 + size], groundColor, base);
  };
  if (hasTerrain) {
    // Coarse cells where the ground is flat, a fine regular grid over the bumps.
    const coarse = TERRAIN_CELL * 8;
    const cells = Math.ceil((reach * 2) / coarse);
    for (let ix = 0; ix < cells; ix++) {
      for (let iz = 0; iz < cells; iz++) {
        const x0 = -reach + ix * coarse;
        const z0 = -reach + iz * coarse;
        if (!needsDetail(x0, x0 + coarse, z0, z0 + coarse)) {
          quad(x0, z0, coarse);
          continue;
        }
        for (let fx = 0; fx < 8; fx++) {
          for (let fz = 0; fz < 8; fz++)
            quad(x0 + fx * TERRAIN_CELL, z0 + fz * TERRAIN_CELL, TERRAIN_CELL);
        }
      }
    }
  } else {
    quad(-reach, -reach, reach * 2);
  }

  // --- Areas -------------------------------------------------------------
  const green = new MeshBuilder("layer_green");
  const water = new MeshBuilder("layer_water");
  const paths = new MeshBuilder("layer_path");
  const grassColors = palette.grass.map(hexToLinear);
  const shade: Record<GreenKind, number> = { park: 0, lawn: 1, wood: 2 };
  const greenAreas: { area: OsmArea; kind: GreenKind }[] = [];
  const waterAreas: OsmArea[] = [];

  // Big areas first so small ones (a lawn inside a park) are painted on top.
  const bySize = [...osm.areas].sort((a, b) => ringArea(b.outer) - ringArea(a.outer));
  for (const area of bySize) {
    if (area.outer.length < 3) continue;
    const kind = greenKind(area.tags);
    if (kind) {
      const color = grassColors[shade[kind] % grassColors.length];
      addGroundPolygon(green, area.outer, area.holes, color, layer);
      greenAreas.push({ area, kind });
      debug.push(
        `<path d="${svgPath(area.outer)}" fill="${palette.grass[shade[kind] % palette.grass.length]}"/>`,
      );
    } else if (isWater(area.tags)) {
      addGroundPolygon(water, area.outer, area.holes, hexToLinear(palette.water), layer);
      waterAreas.push(area);
      debug.push(`<path d="${svgPath(area.outer)}" fill="${palette.water}"/>`);
    } else if (isSand(area.tags)) {
      addGroundPolygon(paths, area.outer, area.holes, hexToLinear(palette.path), layer);
      debug.push(`<path d="${svgPath(area.outer)}" fill="${palette.path}"/>`);
    } else if (isPlaza(area.tags)) {
      addGroundPolygon(paths, area.outer, area.holes, hexToLinear(palette.plaza), layer);
      debug.push(`<path d="${svgPath(area.outer)}" fill="${palette.plaza}"/>`);
    }
  }

  // --- Lines -------------------------------------------------------------
  const curbs = new MeshBuilder("layer_curb");
  const roads = new MeshBuilder("layer_road");
  const markings = new MeshBuilder("layer_marking");
  const roadLines: Line[] = [];
  const pathLines: Line[] = [];
  const markingColor = hexToLinear("#f1ece0");
  const railColor = hexToLinear("#5b5a63");

  // Routes for background pedestrians: footpaths and sidewalks inside the walkable area.
  const footLines: Vec2[][] = [];
  const strollable = place.halfSize - 6;
  for (const way of osm.ways) {
    const type = way.tags.highway;
    if (!type || way.tags.area === "yes" || (way.tags.tunnel && way.tags.tunnel !== "no")) continue;
    if (!["footway", "path", "pedestrian"].includes(type) || way.tags.footway === "crossing")
      continue;
    // Keep the longest stretch that stays inside the walkable square.
    let run: Vec2[] = [];
    const flush = () => {
      if (run.length >= 2) footLines.push(run);
      run = [];
    };
    for (const point of way.points) {
      if (Math.abs(point[0]) < strollable && Math.abs(point[1]) < strollable) run.push(point);
      else flush();
    }
    flush();
  }
  const lineLength = (line: Vec2[]) =>
    line
      .slice(1)
      .reduce(
        (sum, point, index) =>
          sum + Math.hypot(point[0] - line[index][0], point[1] - line[index][1]),
        0,
      );

  const drawLine = (way: OsmWay) => {
    const tags = way.tags;
    if (tags.tunnel && tags.tunnel !== "no") return;
    if (tags.waterway && ["river", "canal", "stream", "ditch"].includes(tags.waterway)) {
      const fallback = tags.waterway === "river" ? 30 : tags.waterway === "canal" ? 22 : 3;
      addRibbon(
        water,
        way.points,
        numeric(tags.width) ?? fallback,
        hexToLinear(palette.water),
        layer,
      );
      debug.push(
        `<path d="${svgPath(way.points, false)}" fill="none" stroke="${palette.water}" stroke-width="${numeric(tags.width) ?? fallback}"/>`,
      );
      return;
    }
    if (tags.railway === "tram" && tags.bridge !== "yes") {
      const { left, right } = ribbonEdges(way.points, 1.435);
      addRibbon(markings, left, 0.16, railColor, layer);
      addRibbon(markings, right, 0.16, railColor, layer);
      return;
    }
    const type = tags.highway?.replace(/_link$/, "");
    if (!type || tags.area === "yes") return;
    if (tags.footway === "sidewalk" || tags.footway === "crossing" || tags.cycleway === "crossing")
      return;

    if (type in ROAD_WIDTHS) {
      const lanes = numeric(tags.lanes);
      const width = numeric(tags.width) ?? (lanes ? lanes * 3.1 + 1 : ROAD_WIDTHS[type]);
      roadLines.push({ points: way.points, width });
      addRibbon(curbs, way.points, width + 0.8, hexToLinear(palette.curb), layer);
      addRibbon(roads, way.points, width, hexToLinear(palette.road), layer);
      if (["primary", "secondary", "tertiary"].includes(type) && tags.oneway !== "yes") {
        for (const dash of dashPolyline(way.points, 3, 6)) {
          addRibbon(markings, dash, 0.18, markingColor, layer);
        }
      }
      debug.push(
        `<path d="${svgPath(way.points, false)}" fill="none" stroke="${palette.road}" stroke-width="${width}"/>`,
      );
    } else if (type === "pedestrian") {
      const width = numeric(tags.width) ?? 5;
      pathLines.push({ points: way.points, width });
      addRibbon(paths, way.points, width, hexToLinear(palette.plaza), layer);
      debug.push(
        `<path d="${svgPath(way.points, false)}" fill="none" stroke="${palette.plaza}" stroke-width="${width}"/>`,
      );
    } else if (type in PATH_WIDTHS) {
      const width = Math.min(numeric(tags.width) ?? PATH_WIDTHS[type], 6);
      pathLines.push({ points: way.points, width });
      addRibbon(paths, way.points, width, hexToLinear(palette.path), layer);
      debug.push(
        `<path d="${svgPath(way.points, false)}" fill="none" stroke="${palette.path}" stroke-width="${width}"/>`,
      );
    }
  };
  for (const way of osm.ways) drawLine(way);

  // --- Trees -------------------------------------------------------------
  const trees: PlaceManifest["trees"] = [];
  const allLines = [...roadLines, ...pathLines];
  const nearLine = (x: number, z: number, clearance: number) =>
    allLines.some((line) => {
      for (let i = 0; i + 1 < line.points.length; i++) {
        if (
          distanceToSegment(x, z, line.points[i], line.points[i + 1]) <
          line.width / 2 + clearance
        )
          return true;
      }
      return false;
    });
  const inBuilding = (x: number, z: number, margin: number) =>
    buildings.some(
      (b) =>
        x > b.bounds.minX - margin &&
        x < b.bounds.maxX + margin &&
        z > b.bounds.minZ - margin &&
        z < b.bounds.maxZ + margin,
    );
  const inWater = (x: number, z: number) =>
    waterAreas.some((area) => pointInPolygon(x, z, area.outer));
  const reserved: Vec2[] = [
    [place.spawn.x, place.spawn.z],
    ...place.npcs.map((spot): Vec2 => [spot.x, spot.z]),
    ...place.props.map((prop): Vec2 => [prop.x, prop.z]),
    ...place.seats.map((seat): Vec2 => [seat.x, seat.z]),
  ];
  const nearReserved = (x: number, z: number, clearance: number) =>
    reserved.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < clearance);
  const nearTree = (x: number, z: number, clearance: number) =>
    trees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < clearance);
  const addTree = (x: number, z: number, scale: number) => {
    trees.push([round(x), round(z), round(scale), Math.floor(random() * 3)]);
  };

  for (const node of osm.nodes) {
    if (node.tags.natural !== "tree" || !inReach(node.position, 1)) continue;
    const [x, z] = node.position;
    if (nearReserved(x, z, 2.5) || nearTree(x, z, 2)) continue;
    addTree(x, z, 0.85 + random() * 0.45);
  }
  for (const way of osm.ways) {
    if (way.tags.natural !== "tree_row") continue;
    for (const { point } of alongPolyline(way.points, 9)) {
      if (
        inReach(point, 1) &&
        !nearTree(point[0], point[1], 4) &&
        !nearReserved(point[0], point[1], 2.5)
      ) {
        addTree(point[0], point[1], 0.9 + random() * 0.4);
      }
    }
  }
  const mapped = trees.length;

  // Parks are rarely mapped tree by tree: scatter some, keeping lawns, paths and water clear.
  const scatterHosts = greenAreas.filter(({ kind }) => kind !== "lawn");
  const lawns = greenAreas.filter(({ kind }) => kind === "lawn");
  const totalArea = scatterHosts.reduce((sum, { area }) => sum + ringArea(area.outer), 0);
  for (const { area, kind } of scatterHosts) {
    const share = totalArea > 0 ? ringArea(area.outer) / totalArea : 0;
    const target = Math.round(place.scatterTrees * share * (kind === "wood" ? 1.5 : 1));
    const xs = area.outer.map((p) => p[0]);
    const zs = area.outer.map((p) => p[1]);
    const [minX, maxX] = [Math.max(-reach, Math.min(...xs)), Math.min(reach, Math.max(...xs))];
    const [minZ, maxZ] = [Math.max(-reach, Math.min(...zs)), Math.min(reach, Math.max(...zs))];
    let placed = 0;
    for (let attempt = 0; attempt < target * 40 && placed < target; attempt++) {
      const x = minX + random() * (maxX - minX);
      const z = minZ + random() * (maxZ - minZ);
      if (!pointInPolygon(x, z, area.outer)) continue;
      if (area.holes.some((hole) => pointInPolygon(x, z, hole))) continue;
      // Lawns stay mostly open: only the occasional solitary tree.
      if (lawns.some((lawn) => pointInPolygon(x, z, lawn.area.outer)) && random() > 0.12) continue;
      if (nearLine(x, z, 2.2) || inWater(x, z) || inBuilding(x, z, 2)) continue;
      if (nearTree(x, z, 6) || nearReserved(x, z, 7)) continue;
      addTree(x, z, 0.9 + random() * 0.7);
      placed++;
    }
  }

  // --- Benches -----------------------------------------------------------
  const benches: PlaceManifest["benches"] = [];
  for (const node of osm.nodes) {
    if (node.tags.amenity !== "bench" || !inReach(node.position, 1)) continue;
    const [x, z] = node.position;
    let heading = headingFromDirection(node.tags.direction);
    if (heading === null) {
      // Face the closest path or road.
      let best = Infinity;
      heading = 0;
      for (const line of allLines) {
        for (let i = 0; i + 1 < line.points.length; i++) {
          const [a, b] = [line.points[i], line.points[i + 1]];
          const distance = distanceToSegment(x, z, a, b);
          if (distance >= best) continue;
          best = distance;
          const dx = b[0] - a[0];
          const dz = b[1] - a[1];
          const lengthSquared = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSquared));
          heading = Math.atan2(a[0] + t * dx - x, a[1] + t * dz - z);
        }
      }
    }
    benches.push([round(x), round(z), round(heading)]);
  }

  // --- Lamps -------------------------------------------------------------
  const lamps: PlaceManifest["lamps"] = [];
  const nearLamp = (x: number, z: number, clearance: number) =>
    lamps.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < clearance);
  for (const node of osm.nodes) {
    if (node.tags.highway === "street_lamp" && inReach(node.position, 1)) {
      lamps.push([round(node.position[0]), round(node.position[1])]);
    }
  }
  if (lamps.length < 12) {
    const place_ = (lines: Line[], spacing: number, side: number) => {
      for (const line of lines) {
        let flip = 1;
        for (const { point, direction } of alongPolyline(line.points, spacing)) {
          const offset = (line.width / 2 + side) * flip;
          const x = point[0] - direction[1] * offset;
          const z = point[1] + direction[0] * offset;
          flip = -flip;
          if (!inReach([x, z], 2) || nearLamp(x, z, spacing * 0.6)) continue;
          if (inBuilding(x, z, 0.5) || nearTree(x, z, 1.5) || inWater(x, z)) continue;
          lamps.push([round(x), round(z)]);
        }
      }
    };
    place_(roadLines, 34, 1.4);
    place_(
      pathLines.filter((line) => line.width >= 2.4),
      42,
      0.9,
    );
  }

  // Footprints: the bottom edge of every upright wall.
  for (const building of buildings) {
    const edges: string[] = [];
    for (const wall of building.walls) {
      const low = wall.outer.filter((vertex) => vertex[1] < 1.5);
      if (low.length < 2) continue;
      const [from, to] = [low[0], low[low.length - 1]];
      edges.push(
        `M${from[0].toFixed(1)},${from[2].toFixed(1)}L${to[0].toFixed(1)},${to[2].toFixed(1)}`,
      );
    }
    debug.push(`<path d="${edges.join("")}" fill="none" stroke="#5a3a28" stroke-width="0.8"/>`);
  }
  for (const [x, z, scale] of trees)
    debug.push(
      `<circle cx="${x}" cy="${z}" r="${2.2 * scale}" fill="#3f7d3a" fill-opacity="0.8"/>`,
    );
  for (const [x, z, heading] of benches) {
    debug.push(
      `<circle cx="${x}" cy="${z}" r="1.2" fill="#b0452f"/><line x1="${x}" y1="${z}" x2="${x + Math.sin(heading) * 3}" y2="${z + Math.cos(heading) * 3}" stroke="#b0452f" stroke-width="0.5"/>`,
    );
  }
  for (const [x, z] of lamps)
    debug.push(
      `<circle cx="${x}" cy="${z}" r="0.9" fill="#f5c542" stroke="#333" stroke-width="0.2"/>`,
    );

  log(
    "env",
    `${place.id}: ${trees.length} trees (${mapped} mapped), ${benches.length} benches, ${lamps.length} lamps`,
  );
  const walkways = footLines
    .filter((line) => lineLength(line) >= 45)
    // Not through buildings (arcades, station halls) or across reserved spots.
    .filter((line) => !line.some(([x, z]) => inBuilding(x, z, -1.5) || nearReserved(x, z, 2.5)))
    .sort((a, b) => lineLength(b) - lineLength(a))
    .slice(0, 6)
    .map((line) => line.map(([x, z]): [number, number] => [round(x), round(z)]));

  return {
    meshes: [ground, green, water, paths, curbs, roads, markings],
    walkways,
    trees,
    benches,
    lamps,
    debug,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Top-down overview with a 50 m grid, for choosing prop and NPC positions. */
function writeDebugSvg(place: Place, scene: Scene) {
  const reach = extentOf(place);
  const grid: string[] = [];
  for (let v = -Math.floor(reach / 50) * 50; v <= reach; v += 50) {
    grid.push(
      `<line x1="${v}" y1="${-reach}" x2="${v}" y2="${reach}" stroke="#000" stroke-opacity="0.25" stroke-width="0.3"/>`,
    );
    grid.push(
      `<line x1="${-reach}" y1="${v}" x2="${reach}" y2="${v}" stroke="#000" stroke-opacity="0.25" stroke-width="0.3"/>`,
    );
    grid.push(
      `<text x="${v + 1}" y="${-reach + 7}" font-size="6">x=${v}</text><text x="${-reach + 1}" y="${v - 1}" font-size="6">z=${v}</text>`,
    );
  }
  const half = place.halfSize;
  const marks = [
    `<rect x="${-half}" y="${-half}" width="${half * 2}" height="${half * 2}" fill="none" stroke="#d00" stroke-width="0.8" stroke-dasharray="4 3"/>`,
    `<circle cx="${place.spawn.x}" cy="${place.spawn.z}" r="2.5" fill="#d00"/>`,
    ...place.npcs.map(
      (spot) =>
        `<circle cx="${spot.x}" cy="${spot.z}" r="2" fill="#7a2bd0"/><text x="${spot.x + 3}" y="${spot.z}" font-size="5">${spot.npc}</text>`,
    ),
    ...place.props.map(
      (prop) => `<rect x="${prop.x - 1.5}" y="${prop.z - 1.5}" width="3" height="3" fill="#0aa"/>`,
    ),
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-reach} ${-reach} ${reach * 2} ${reach * 2}" width="1400" height="1400"><rect x="${-reach}" y="${-reach}" width="${reach * 2}" height="${reach * 2}" fill="${place.palette.ground}"/>${scene.debug.join("")}${grid.join("")}${marks.join("")}</svg>`;
  writeFileSync(join(ensureDir(join(RAW_DIR, "debug")), `${place.id}.svg`), svg);
}

/**
 * Snaps each shop front onto the building wall behind it, so signs and
 * windows sit flush on the facade whatever the footprint looks like.
 * The definition gives a rough position and facing; we walk back from 10 m in
 * front of it and take the first wall we hit.
 */
function snapShops(place: Place, buildings: Building[]): PlaceManifest["shops"] {
  const segments: [Vec2, Vec2][] = [];
  for (const building of buildings) {
    for (const wall of building.walls) {
      const low = wall.outer.filter((vertex) => vertex[1] < 1.5);
      if (low.length < 2) continue;
      const [a, b] = [low[0], low[low.length - 1]];
      segments.push([
        [a[0], a[2]],
        [b[0], b[2]],
      ]);
    }
  }
  return place.shops.map((shop) => {
    const normal: Vec2 = [Math.sin(shop.heading), Math.cos(shop.heading)];
    const origin: Vec2 = [shop.x + normal[0] * 10, shop.z + normal[1] * 10];
    let best = Infinity;
    let heading = shop.heading;
    for (const [a, b] of segments) {
      // Ray origin - t * normal against segment a + u * (b - a).
      const ex = b[0] - a[0];
      const ez = b[1] - a[1];
      const denominator = -normal[0] * ez + normal[1] * ex;
      if (Math.abs(denominator) < 1e-6) continue;
      const t = ((a[0] - origin[0]) * ez - (a[1] - origin[1]) * ex) / denominator;
      const u = (-(a[0] - origin[0]) * normal[1] + (a[1] - origin[1]) * normal[0]) / denominator;
      if (t <= 0 || t >= best || t > 25 || u < 0 || u > 1) continue;
      best = t;
      // Wall normal on the side the shop faces.
      const length = Math.hypot(ex, ez) || 1;
      let nx = -ez / length;
      let nz = ex / length;
      if (nx * normal[0] + nz * normal[1] < 0) {
        nx = -nx;
        nz = -nz;
      }
      heading = Math.atan2(nx, nz);
    }
    if (!Number.isFinite(best)) {
      log("shops", `${place.id}: no wall found behind "${shop.name}", keeping its position`);
      return [shop.x, shop.z, shop.heading];
    }
    const out = 0.12;
    return [
      round(origin[0] - normal[0] * best + Math.sin(heading) * out),
      round(origin[1] - normal[1] * best + Math.cos(heading) * out),
      round(heading),
    ];
  });
}

export async function buildPlace(place: Place, forceOsmBuildings = false): Promise<void> {
  const osm = parseOsm(readFileSync(osmFile(place), "utf8"), frameFor(place));
  const { source, buildings } = await loadBuildings(place, osm, forceOsmBuildings);
  log("buildings", `${place.id}: ${buildings.length} buildings from ${source}`);

  const scene = buildEnvironment(place, osm, buildings);
  const meshes = [...scene.meshes, buildBuildingMesh(place, buildings)];
  const directory = ensureDir(join(ASSET_DIR, "places"));
  const glbBytes = await writeGlb(join(directory, `${place.id}.glb`), meshes);
  const triangles = meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0);

  const manifest: PlaceManifest = {
    id: place.id,
    halfSize: place.halfSize,
    extent: extentOf(place),
    trees: scene.trees,
    benches: scene.benches,
    lamps: scene.lamps,
    shops: snapShops(place, buildings),
    walkways: scene.walkways,
    stats: { buildings: buildings.length, triangles, glbBytes, buildingSource: source },
  };
  writeFileSync(join(directory, `${place.id}.json`), JSON.stringify(manifest));
  writeDebugSvg(place, scene);
  log("place", `${place.id}: ${triangles} triangles, GLB ${(glbBytes / 1e6).toFixed(2)} MB`);
  for (const mesh of meshes) log("place", `  ${mesh.name}: ${mesh.triangleCount}`);
}

runMain(import.meta.url, async () => {
  for (const place of loadPlaces(placeArgs())) await buildPlace(place, hasFlag("osm-buildings"));
});
