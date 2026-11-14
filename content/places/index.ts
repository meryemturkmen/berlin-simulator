import { placeSchema, type Place } from "@/lib/places/schema";
import goerli from "./goerli.json";
import kudamm from "./kudamm.json";
import mitte from "./mitte.json";

/** All playable places, validated at module load. Order is the order on the map. */
export const PLACES: readonly Place[] = [mitte, goerli, kudamm].map((raw) =>
  placeSchema.parse(raw),
);

export const PLACE_IDS = PLACES.map((place) => place.id);

export function getPlace(id: string): Place | undefined {
  return PLACES.find((place) => place.id === id);
}
