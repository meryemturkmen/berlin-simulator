/**
 * Turns building data into a stylized mesh: flat pastel walls, colored roofs,
 * and a per-vertex "wall layout" attribute that the game's shader uses to
 * draw procedural windows.
 *
 * Primary source: Berlin LoD2 CityGML (see fetch_lod2.ts).
 * Fallback: OpenStreetMap footprints extruded by height or levels.
 */
import type { Place } from "../lib/places/schema";
import { tileFiles, tilesFor } from "./fetch_lod2";
import { readBuildings, type Building, type Polygon3 } from "./lib/citygml";
import { extentOf, frameFor, hashString, type Vec3 } from "./lib/geo";
import { log } from "./lib/io";
import { MeshBuilder, hexToLinear, scaleColor, triangulatePlanar } from "./lib/mesh";
import type { OsmData } from "./lib/osm";

const LEVEL_HEIGHT = 3.2;
const DEFAULT_HEIGHT = 15;

export interface BuildingSet {
  source: "lod2" | "osm";
  buildings: Building[];
}

/** Loads LoD2 buildings for a place. Returns null when no tile data is available. */
export async function loadLod2Buildings(place: Place): Promise<Building[] | null> {
  const files = tilesFor(place).flatMap(tileFiles);
  if (files.length === 0) return null;
  const frame = frameFor(place);
  const byId = new Map<string, Building>();
  for (const file of files) {
    for (const building of await readBuildings(file, frame, extentOf(place))) {
      // Buildings on a tile border can appear in both tiles.
      byId.set(building.id, building);
    }
  }
  return [...byId.values()];
}

/** Fallback: extrude OSM building footprints into walls and a flat roof. */
export function osmBuildings(osm: OsmData, reach: number): Building[] {
  const buildings: Building[] = [];
  for (const area of osm.areas) {
    if (!area.tags.building && !area.tags["building:part"]) continue;
    const xs = area.outer.map((point) => point[0]);
    const zs = area.outer.map((point) => point[1]);
    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
    if (
      bounds.maxX < -reach ||
      bounds.minX > reach ||
      bounds.maxZ < -reach ||
      bounds.minZ > reach
    ) {
      continue;
    }
    const levels = Number.parseFloat(area.tags["building:levels"] ?? "");
    const tagged = Number.parseFloat(area.tags.height ?? "");
    const height = Number.isFinite(tagged)
      ? tagged
      : Number.isFinite(levels)
        ? levels * LEVEL_HEIGHT + 1
        : DEFAULT_HEIGHT;

    const walls: Polygon3[] = [];
    for (const ring of [area.outer, ...area.holes]) {
      for (let i = 0; i < ring.length; i++) {
        const [x1, z1] = ring[i];
        const [x2, z2] = ring[(i + 1) % ring.length];
        walls.push({
          outer: [
            [x1, 0, z1],
            [x2, 0, z2],
            [x2, height, z2],
            [x1, height, z1],
          ],
          holes: [],
        });
      }
    }
    const lift = (ring: [number, number][]): Vec3[] => ring.map(([x, z]) => [x, height, z]);
    buildings.push({
      id: area.id,
      function:
        area.tags.amenity === "place_of_worship" || area.tags.building === "church"
          ? "31001_3041"
          : "",
      walls,
      roofs: [{ outer: lift(area.outer), holes: area.holes.map(lift) }],
      bounds,
      baseElevation: 0,
      height,
    });
  }
  return buildings;
}

export async function loadBuildings(
  place: Place,
  osm: OsmData,
  forceOsm = false,
): Promise<BuildingSet> {
  if (!forceOsm) {
    const lod2 = await loadLod2Buildings(place);
    if (lod2 && lod2.length > 0) return { source: "lod2", buildings: lod2 };
    log("buildings", `${place.id}: no LoD2 data, falling back to OSM footprints`);
  }
  return { source: "osm", buildings: osmBuildings(osm, extentOf(place)) };
}

/**
 * Special looks by ALKIS building function, so landmarks do not get the
 * generic "apartment block with windows" treatment.
 */
const FUNCTION_STYLES: { pattern: RegExp; wall: string; roof: string; windows: boolean }[] = [
  // Cultural buildings and memorials (e.g. the Memorial Church ruin): weathered stone.
  { pattern: /^31001_303\d$/, wall: "#8f8479", roof: "#5d5957", windows: false },
  // Churches and chapels: cool blue-gray, like the glass blocks of the new Memorial Church.
  { pattern: /^31001_304\d$/, wall: "#6f7f96", roof: "#55617a", windows: false },
  // Railway station buildings: red brick.
  { pattern: /^31001_309\d$/, wall: "#a5573f", roof: "#5d5957", windows: true },
  // Canopies and bridges: plain concrete.
  { pattern: /^(51009_1610|53001_\d+)$/, wall: "#b9b3a8", roof: "#9e988d", windows: false },
];

/**
 * Appends all buildings to one mesh.
 * Extra attribute per vertex: [u along wall (m), height above ground (m),
 * wall width (m, 0 for roofs and tilted faces), height of the wall's top edge (m)].
 */
export function buildBuildingMesh(place: Place, buildings: Building[]): MeshBuilder {
  const mesh = new MeshBuilder("buildings", true);
  const wallColors = place.palette.walls.map(hexToLinear);
  const roofColors = place.palette.roofs.map(hexToLinear);

  for (const building of buildings) {
    const hash = hashString(building.id);
    const tint = 0.94 + ((hash >>> 10) % 100) / 100 / 8;
    const style = FUNCTION_STYLES.find((candidate) => candidate.pattern.test(building.function));
    const wallColor = style
      ? hexToLinear(style.wall)
      : scaleColor(wallColors[hash % wallColors.length], tint);
    const roofColor = style
      ? hexToLinear(style.roof)
      : scaleColor(roofColors[(hash >>> 5) % roofColors.length], tint);
    const windows = style?.windows ?? true;

    for (const wall of building.walls) {
      const result = triangulatePlanar(wall.outer, wall.holes);
      if (!result) continue;
      // Steeply tilted "walls" (dormer cheeks etc.) still count as walls, but
      // only upright ones get a window layout.
      const upright = windows && Math.abs(result.normal[1]) < 0.3;
      let minU = Infinity;
      let maxU = -Infinity;
      let top = 0;
      for (let i = 0; i < wall.outer.length; i++) {
        minU = Math.min(minU, result.uv[i][0]);
        maxU = Math.max(maxU, result.uv[i][0]);
        top = Math.max(top, wall.outer[i][1]);
      }
      const width = upright ? maxU - minU : 0;
      const extra = (index: number) => [
        result.uv[index][0] - minU,
        result.vertices[index][1],
        width,
        top,
      ];
      for (const [a, b, c] of result.triangles) {
        mesh.addTriangle(result.vertices[a], result.vertices[b], result.vertices[c], wallColor, [
          extra(a),
          extra(b),
          extra(c),
        ]);
      }
    }

    for (const roof of building.roofs) {
      const result = triangulatePlanar(roof.outer, roof.holes);
      if (!result) continue;
      // Flat roofs read better slightly lighter than pitched ones.
      const color = result.normal[1] > 0.98 ? scaleColor(roofColor, 1.12) : roofColor;
      for (const [a, b, c] of result.triangles) {
        const extra = (index: number) => [0, result.vertices[index][1], 0, 0];
        mesh.addTriangle(result.vertices[a], result.vertices[b], result.vertices[c], color, [
          extra(a),
          extra(b),
          extra(c),
        ]);
      }
    }
  }
  return mesh;
}
