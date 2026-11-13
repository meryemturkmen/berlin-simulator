import type { Language } from "@/game/store/settings";
import { confusedReply, trimReply } from "./guardrails";
import { npcReplySchema, type ActionId, type Npc, type NpcReply } from "./schema";

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: " ",
  r: "",
  b: "",
  f: "",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/**
 * Pulls the text of the "reply" field out of JSON that is still streaming in.
 * Returns everything decoded so far, so the chat can show words as they arrive.
 * Incomplete escape sequences at the end are held back until complete.
 */
export function extractPartialReply(buffer: string): string {
  const key = buffer.search(/"reply"\s*:\s*"/);
  if (key === -1) return "";
  let index = buffer.indexOf('"', buffer.indexOf(":", key) + 1) + 1;
  let text = "";
  while (index < buffer.length) {
    const char = buffer[index];
    if (char === '"') break;
    if (char !== "\\") {
      text += char;
      index++;
      continue;
    }
    const next = buffer[index + 1];
    if (next === undefined) break;
    if (next === "u") {
      const hex = buffer.slice(index + 2, index + 6);
      if (hex.length < 4) break;
      const code = Number.parseInt(hex, 16);
      if (!Number.isNaN(code)) text += String.fromCharCode(code);
      index += 6;
      continue;
    }
    text += ESCAPES[next] ?? next;
    index += 2;
  }
  return text;
}

function extractJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Validates a complete model answer. Tolerates code fences and stray text
 * around the JSON, unknown emotions and actions the NPC does not have. If the
 * JSON is broken but a reply text can be recovered, that text is used; if not,
 * the NPC asks the player to repeat.
 */
export function parseNpcReply(raw: string, npc: Npc, language: Language): NpcReply {
  const allowed = new Set<string>(npc.availableActions.map((action) => action.id));
  const parsed = npcReplySchema.safeParse(extractJsonObject(raw));
  if (parsed.success) {
    const action =
      parsed.data.action && allowed.has(parsed.data.action) ? parsed.data.action : null;
    return {
      reply: trimReply(parsed.data.reply),
      emotion: parsed.data.emotion,
      action: action as ActionId | null,
    };
  }
  const recovered = trimReply(extractPartialReply(raw));
  if (recovered) return { reply: recovered, emotion: "neutral", action: null };
  return { reply: confusedReply(language), emotion: "thoughtful", action: null };
}
