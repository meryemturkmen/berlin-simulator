/**
 * Downloads a true orthophoto (aerial image without building lean) for each
 * place and stores it as the ground texture.
 * Source: Geoportal Berlin, "Digitale farbige TrueOrthophotos 2024
 * (DOP20RGBI)", WMS, Datenlizenz Deutschland - Zero - Version 2.0.
 *
 * The image covers exactly the scenery square of the place, north up, at the
 * data's native 20 cm per pixel.
 * Usage: tsx scripts/fetch_ortho.ts [placeId...] [--force]
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Place } from "../lib/places/schema";
import { extentOf, frameFor } from "./lib/geo";
import {
  ASSET_DIR,
  RAW_DIR,
  download,
  ensureDir,
  hasFlag,
  loadPlaces,
  log,
  placeArgs,
  runMain,
} from "./lib/io";

const WMS = "https://gdi.berlin.de/services/wms/truedop_2024";
const METERS_PER_PIXEL = 0.2;

export function orthoAsset(place: Place): string {
  return join(ASSET_DIR, "places", `${place.id}-ground.jpg`);
}

export async function fetchOrtho(places: Place[], force = false): Promise<void> {
  const rawDir = ensureDir(join(RAW_DIR, "ortho"));
  ensureDir(join(ASSET_DIR, "places"));
  for (const place of places) {
    const raw = join(rawDir, `${place.id}.jpg`);
    if (force || !existsSync(raw)) {
      const frame = frameFor(place);
      const reach = extentOf(place);
      const pixels = Math.round((reach * 2) / METERS_PER_PIXEL);
      const bbox = [
        frame.east - reach,
        frame.north - reach,
        frame.east + reach,
        frame.north + reach,
      ];
      const url =
        `${WMS}?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2024&styles=` +
        `&crs=EPSG:25833&bbox=${bbox.join(",")}&width=${pixels}&height=${pixels}&format=image/jpeg`;
      const response = await download(url, 180_000);
      if (!response.headers.get("content-type")?.startsWith("image/")) {
        throw new Error(`Orthophoto request for ${place.id} did not return an image`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(raw, buffer);
      log("ortho", `${place.id}: ${pixels} px, ${(buffer.length / 1e6).toFixed(2)} MB`);
    } else {
      log("ortho", `${place.id} cached`);
    }
    copyFileSync(raw, orthoAsset(place));
  }
}

runMain(import.meta.url, () => fetchOrtho(loadPlaces(placeArgs()), hasFlag("force")));
