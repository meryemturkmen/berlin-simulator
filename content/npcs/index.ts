import { npcSchema, type Npc } from "@/lib/npc/schema";
import jule from "./jule.json";
import micha from "./micha.json";
import tarek from "./tarek.json";

/** All NPC definitions, validated at module load. */
export const NPCS: readonly Npc[] = [jule, tarek, micha].map((raw) => npcSchema.parse(raw));

export function getNpc(id: string): Npc | undefined {
  return NPCS.find((npc) => npc.id === id);
}
