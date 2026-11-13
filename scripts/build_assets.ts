/**
 * Rebuilds every generated asset in public/assets from open data.
 * Usage: pnpm assets:build [placeId...] [--force] [--osm-buildings]
 *   --force          re-download raw data even if cached in data/raw
 *   --osm-buildings  skip LoD2 and extrude OpenStreetMap footprints instead
 */
import { buildPlace } from "./build_place";
import { fetchLod2 } from "./fetch_lod2";
import { fetchOsm } from "./fetch_osm";
import { hasFlag, loadPlaces, log, placeArgs, runMain } from "./lib/io";

runMain(import.meta.url, async () => {
  const places = loadPlaces(placeArgs());
  const force = hasFlag("force");
  const osmBuildings = hasFlag("osm-buildings");

  if (!osmBuildings) {
    try {
      await fetchLod2(places, force);
    } catch (error) {
      // The documented fallback: without LoD2 tiles, buildings come from OSM.
      log("lod2", `download failed (${(error as Error).message}); using OSM buildings instead`);
    }
  }
  await fetchOsm(places, force);
  for (const place of places) await buildPlace(place, osmBuildings);
  log("assets", `done: ${places.map((place) => place.id).join(", ")}`);
});
