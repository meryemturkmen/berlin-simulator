import type { Language } from "@/game/store/settings";
import { deflection, looksLikeInjection } from "./guardrails";
import type { Npc, NpcMemory, NpcReply } from "./schema";

const UNSAFE_REQUEST =
  /\b(sex|nackt|naked|porn\w*|drogen|droge|drugs?|dealer|weed|kiffen|kokain|cocaine|töten|umbringen|kill|schlagen|hass\w*|hate)\b/i;

/**
 * Local stand-in for the language model. Picks a canned, in-character line:
 * rule matches first (so "matcha" really orders a matcha), then small talk in
 * rotation. Produces the same JSON shape the real model is asked for.
 */
export function mockReply(
  npc: Npc,
  message: string,
  language: Language,
  memory?: NpcMemory,
): NpcReply {
  const turn = memory?.turns ?? 0;
  if (looksLikeInjection(message) || UNSAFE_REQUEST.test(message)) {
    return { reply: deflection(language, turn), emotion: "thoughtful", action: null };
  }
  const script = npc.mock[language];
  const lower = message.toLowerCase();
  const rule = script.rules.find((candidate) =>
    candidate.match.some((keyword) => lower.includes(keyword)),
  );
  if (rule) return { reply: rule.reply, emotion: rule.emotion, action: rule.action };
  return {
    reply: script.smalltalk[turn % script.smalltalk.length],
    emotion: "neutral",
    action: null,
  };
}

/** Yields the JSON text in small pieces, like a streaming model would. */
export async function* mockStream(reply: NpcReply, delayMs = 12): AsyncGenerator<string> {
  const json = JSON.stringify(reply);
  for (let index = 0; index < json.length; index += 5) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield json.slice(index, index + 5);
  }
}
