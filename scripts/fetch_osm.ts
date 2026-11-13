/**
 * Downloads OpenStreetMap data around each place as OSM XML.
 * © OpenStreetMap contributors, ODbL.
 *
 * Tries the Overpass API first and falls back to the main OSM API's map
 * endpoint, which returns the same data model for small bounding boxes.
 * Usage: tsx scripts/fetch_osm.ts [placeId...] [--force]
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Place } from "../lib/places/schema";
import { wgsBounds } from "./lib/geo";
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

export const OSM_DIR = join(RAW_DIR, "osm");
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function osmFile(place: Place): string {
  return join(OSM_DIR, `${place.id}.osm`);
}

async function fromOverpass(endpoint: string, bbox: ReturnType<typeof wgsBounds>): Promise<string> {
  const area = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:xml][timeout:25];(node(${area});way(${area});relation(${area}););out body;>;out skel qt;`;
  const response = await download(endpoint, 30_000, {
    method: "POST",
    body: new URLSearchParams({ data: query }),
  });
  return response.text();
}

async function fromOsmApi(bbox: ReturnType<typeof wgsBounds>): Promise<string> {
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}`;
  return (await download(url, 120_000)).text();
}

export async function fetchOsm(places: Place[], force = false): Promise<void> {
  ensureDir(OSM_DIR);
  for (const place of places) {
    const file = osmFile(place);
    if (!force && existsSync(file)) {
      log("osm", `${place.id} cached`);
      continue;
    }
    const bbox = wgsBounds(place, 20);
    let xml: string | null = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        xml = await fromOverpass(endpoint, bbox);
        log("osm", `${place.id}: fetched from ${new URL(endpoint).host}`);
        break;
      } catch (error) {
        log("osm", `${new URL(endpoint).host} failed (${(error as Error).message}), trying next`);
      }
    }
    if (xml === null) {
      xml = await fromOsmApi(bbox);
      log("osm", `${place.id}: fetched from api.openstreetmap.org`);
    }
    if (!xml.includes("<osm")) throw new Error(`Unexpected OSM response for ${place.id}`);
    writeFileSync(file, xml);
    log("osm", `${place.id}: ${(xml.length / 1e6).toFixed(2)} MB`);
  }
}

runMain(import.meta.url, () => fetchOsm(loadPlaces(placeArgs()), hasFlag("force")));
