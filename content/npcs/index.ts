import { npcSchema, type Npc } from "@/lib/npc/schema";
import carla from "./carla.json";
import diego from "./diego.json";
import henrik from "./henrik.json";
import jule from "./jule.json";
import lehmann from "./lehmann.json";
import micha from "./micha.json";
import noor from "./noor.json";
import tarek from "./tarek.json";

/** All NPC definitions, validated at module load. */
export const NPCS: readonly Npc[] = [noor, henrik, jule, tarek, micha, carla, diego, lehmann].map(
  (raw) => npcSchema.parse(raw),
);

export function getNpc(id: string): Npc | undefined {
  return NPCS.find((npc) => npc.id === id);
}
