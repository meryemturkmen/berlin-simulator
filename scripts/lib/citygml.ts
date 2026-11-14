import { createReadStream } from "node:fs";
import { SaxesParser } from "saxes";
import type { Frame, Vec3 } from "./geo";

/** A planar polygon in the local frame: outer ring plus optional holes. */
export interface Polygon3 {
  outer: Vec3[];
  holes: Vec3[][];
}

export interface Building {
  id: string;
  /** ALKIS function code, e.g. "31001_3041" for a church. Empty if not given. */
  function: string;
  walls: Polygon3[];
  roofs: Polygon3[];
  /** Footprint bounds in local X/Z. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Lowest wall vertex before normalization (terrain height in the source data). */
  baseElevation: number;
  height: number;
}

type SurfaceKind = "wall" | "roof" | "skip";

const SURFACE_KINDS: Record<string, SurfaceKind> = {
  "bldg:WallSurface": "wall",
  "bldg:RoofSurface": "roof",
  "bldg:GroundSurface": "skip",
  "bldg:ClosureSurface": "skip",
  "bldg:OuterFloorSurface": "roof",
  "bldg:OuterCeilingSurface": "skip",
};

/**
 * Streams a CityGML 1.0/2.0 LoD2 file and returns its buildings in the local
 * frame (meters, Y up, each building resting on y = 0). Building parts are
 * merged into their parent building. Buildings entirely outside `reach`
 * meters of the origin are dropped.
 */
export async function readBuildings(
  file: string,
  frame: Frame,
  reach: number,
): Promise<Building[]> {
  const buildings: Building[] = [];
  let current: { id: string; function: string; walls: Polygon3[]; roofs: Polygon3[] } | null = null;
  let buildingDepth = 0;
  let surface: SurfaceKind | null = null;
  let polygon: Polygon3 | null = null;
  let ringRole: "outer" | "hole" | null = null;
  let text: string | null = null;

  const toLocal = (values: number[]): Vec3[] => {
    const ring: Vec3[] = [];
    for (let index = 0; index + 2 < values.length; index += 3) {
      // East -> +X, height -> +Y, north -> -Z.
      ring.push([values[index] - frame.east, values[index + 2], frame.north - values[index + 1]]);
    }
    // GML rings repeat the first vertex at the end.
    if (ring.length > 1) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] === last[0] && first[1] === last[1] && first[2] === last[2]) ring.pop();
    }
    return ring;
  };

  const finish = () => {
    if (!current) return;
    const { id, walls, roofs } = current;
    const functionCode = current.function;
    current = null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const part of [...walls, ...roofs]) {
      for (const [x, y, z] of part.outer) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (walls.length === 0 || !Number.isFinite(minX)) return;
    if (maxX < -reach || minX > reach || maxZ < -reach || minZ > reach) return;
    for (const part of [...walls, ...roofs]) {
      for (const ring of [part.outer, ...part.holes]) for (const vertex of ring) vertex[1] -= minY;
    }
    buildings.push({
      id,
      function: functionCode,
      walls,
      roofs,
      bounds: { minX, maxX, minZ, maxZ },
      baseElevation: minY,
      height: maxY - minY,
    });
  };

  const parser = new SaxesParser();
  parser.on("opentag", (tag) => {
    switch (tag.name) {
      case "bldg:Building":
        if (buildingDepth === 0) {
          current = {
            id: String(tag.attributes["gml:id"] ?? buildings.length),
            function: "",
            walls: [],
            roofs: [],
          };
        }
        buildingDepth++;
        return;
      case "gml:Polygon":
        if (surface && surface !== "skip") polygon = { outer: [], holes: [] };
        return;
      case "gml:exterior":
        ringRole = "outer";
        return;
      case "gml:interior":
        ringRole = "hole";
        return;
      case "gml:posList":
        if (polygon) text = "";
        return;
      case "bldg:function":
        if (current && !current.function) text = "";
        return;
    }
    if (tag.name in SURFACE_KINDS) surface = SURFACE_KINDS[tag.name];
  });
  parser.on("text", (chunk) => {
    if (text !== null) text += chunk;
  });
  parser.on("closetag", (tag) => {
    switch (tag.name) {
      case "gml:posList":
        if (polygon && text !== null) {
          const ring = toLocal(text.trim().split(/\s+/).map(Number));
          if (ringRole === "hole") polygon.holes.push(ring);
          else polygon.outer = ring;
        }
        text = null;
        return;
      case "bldg:function":
        if (current && text !== null) current.function = text.trim();
        text = null;
        return;
      case "gml:Polygon":
        if (polygon && polygon.outer.length >= 3 && current) {
          (surface === "roof" ? current.roofs : current.walls).push(polygon);
        }
        polygon = null;
        return;
      case "bldg:Building":
        buildingDepth--;
        if (buildingDepth === 0) finish();
        return;
    }
    if (tag.name in SURFACE_KINDS) surface = null;
  });

  await new Promise<void>((resolve, reject) => {
    parser.on("error", reject);
    createReadStream(file, { encoding: "utf8", highWaterMark: 1 << 20 })
      .on("data", (chunk) => parser.write(chunk as string))
      .on("end", () => {
        parser.close();
        resolve();
      })
      .on("error", reject);
  });
  return buildings;
}
