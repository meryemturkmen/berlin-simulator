/**
 * Downloads the Berlin LoD2 building tiles (CityGML, EPSG:25833) that cover
 * each place. Source: Geoportal Berlin, "3D-Gebäudemodelle im Level of Detail
 * 2 (LoD 2)", https://gdi.berlin.de/data/a_lod2/atom/ (dl-de/zero-2-0).
 *
 * Tiles are 1 x 1 km and named LoD2_<east km>_<north km>.zip.
 * Usage: tsx scripts/fetch_lod2.ts [placeId...] [--force]
 */
import AdmZip from "adm-zip";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Place } from "../lib/places/schema";
import { extentOf, frameFor } from "./lib/geo";
import {
  RAW_DIR,
  download,
  ensureDir,
  hasFlag,
  loadPlaces,
  log,
  placeArgs,
  runMain,
} from "./lib/io";

const FEED = "https://gdi.berlin.de/data/a_lod2/atom";
export const LOD2_DIR = join(RAW_DIR, "lod2");

/** Names of the 1 km tiles that intersect the place's scenery square. */
export function tilesFor(place: Place): string[] {
  const frame = frameFor(place);
  const reach = extentOf(place) + 30;
  const tiles: string[] = [];
  for (
    let e = Math.floor((frame.east - reach) / 1000);
    e <= Math.floor((frame.east + reach) / 1000);
    e++
  ) {
    for (
      let n = Math.floor((frame.north - reach) / 1000);
      n <= Math.floor((frame.north + reach) / 1000);
      n++
    ) {
      tiles.push(`LoD2_${e}_${n}`);
    }
  }
  return tiles;
}

/** Paths of the extracted CityGML files for a tile (empty if not downloaded). */
export function tileFiles(tile: string): string[] {
  const directory = join(LOD2_DIR, tile);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => /\.(xml|gml)$/i.test(file))
    .map((file) => join(directory, file));
}

export async function fetchLod2(places: Place[], force = false): Promise<void> {
  ensureDir(LOD2_DIR);
  const tiles = [...new Set(places.flatMap(tilesFor))];
  for (const tile of tiles) {
    if (!force && tileFiles(tile).length > 0) {
      log("lod2", `${tile} cached`);
      continue;
    }
    log("lod2", `downloading ${tile}.zip`);
    const response = await download(`${FEED}/${tile}.zip`, 300_000);
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(LOD2_DIR, `${tile}.zip`), buffer);
    new AdmZip(buffer).extractAllTo(ensureDir(join(LOD2_DIR, tile)), true);
    log("lod2", `${tile}: ${(buffer.length / 1e6).toFixed(1)} MB`);
  }
}

runMain(import.meta.url, () => fetchLod2(loadPlaces(placeArgs()), hasFlag("force")));
