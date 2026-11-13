import { MAX_MEMORY_MESSAGES, MAX_REPLY_LENGTH, type NpcMemory } from "./schema";

/** Refresh the long-term summary every this many player turns. */
export const SUMMARY_EVERY_TURNS = 3;

/** Adds one player/NPC exchange and keeps only the most recent messages. */
export function appendExchange(memory: NpcMemory, playerText: string, npcText: string): NpcMemory {
  const messages = [
    ...memory.messages,
    { role: "player" as const, text: playerText.slice(0, MAX_REPLY_LENGTH) },
    { role: "npc" as const, text: npcText.slice(0, MAX_REPLY_LENGTH) },
  ].slice(-MAX_MEMORY_MESSAGES);
  return { ...memory, messages, turns: memory.turns + 1 };
}

export function shouldSummarize(memory: NpcMemory): boolean {
  return memory.turns > 0 && memory.turns % SUMMARY_EVERY_TURNS === 0;
}

/**
 * Summary used when no model is available: remembers the name and how often
 * the two have talked, which is enough for "nice to see you again, Mer".
 */
export function offlineSummary(playerName: string, memory: NpcMemory): string {
  return `The player is called ${playerName}. You have exchanged ${memory.turns} messages so far and it was friendly.`;
}
