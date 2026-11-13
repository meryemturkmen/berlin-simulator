import type { Language } from "@/game/store/settings";
import { MAX_PLAYER_MESSAGE_LENGTH, MAX_REPLY_LENGTH } from "./schema";

/** Unique marker placed in the system prompt. If it ever shows up in a reply, the prompt leaked. */
export const PROMPT_CANARY = "BSIM-7Q4X-RULES";

const INJECTION_PATTERNS: RegExp[] = [
  /ignor\w*\s+(all|any|the|your|previous|prior|above|alle|deine|die|vorherigen|bisherigen)\b.{0,40}(instruction|rule|prompt|anweisung|regel|vorgabe)/i,
  /(system|developer|initial)\s*[- ]?\s*(prompt|message|nachricht|anweisung)/i,
  /systemprompt/i,
  /(reveal|show|print|repeat|tell me|give me|zeig|nenn|verrat|wiederhol|gib)\w*\s.{0,40}(your|deine[nr]?|the|die)\s+(instruction|rule|prompt|anweisung|regel|vorgabe)/i,
  /you are (now|no longer)|du bist (jetzt|ab jetzt|nicht mehr)\b/i,
  /\b(jailbreak|dan mode|developer mode|entwicklermodus)\b/i,
  /(pretend|act|behave|roleplay)\s+(as|like|to be)\s+(an?\s+)?(ai|assistant|language model|chatbot|different|another)/i,
  /(tu so|verhalte dich|spiel)\s.{0,20}(als|wie)\s.{0,20}(ki|assistent|sprachmodell|chatbot)/i,
  /(forget|disregard|override|vergiss|missachte|überschreib)\w*\s.{0,40}(instruction|rule|role|character|anweisung|regel|rolle)/i,
  /<\/?\s*(system|assistant|player_message|instructions?)\s*>/i,
  /\b(as an ai|als ki)\b.{0,30}(language model|sprachmodell)/i,
];

/** True when a player message looks like an attempt to change or extract the NPC's instructions. */
export function looksLikeInjection(message: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(message));
}

// Control characters, zero-width characters and bidi overrides: invisible ways to smuggle text.
const CONTROL_CHARACTERS = new RegExp(
  "[" +
    ["0000-", "0008", "000b-", "001f", "007f", "200b-", "200f", "2028-", "202e"]
      .map(
        (part) =>
          String.fromCharCode(92) + "u" + part.replace("-", "") + (part.endsWith("-") ? "-" : ""),
      )
      .join("") +
    "]",
  "g",
);

/**
 * Cleans a player message before it is placed in the prompt: control
 * characters out, our own delimiter tags neutralized, whitespace collapsed,
 * length capped.
 */
export function sanitizePlayerMessage(message: string): string {
  return message
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/<\s*\/?\s*player_message[^>]*>/gi, "")
    .replace(/[<>]/g, (bracket) => (bracket === "<" ? "‹" : "›"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PLAYER_MESSAGE_LENGTH);
}

// Topics the game never talks about, whatever the model produces.
const BLOCKED_OUTPUT: RegExp[] = [
  /\b(drogen|droge|dealer|dealen|kokain|koks|heroin|crack|ecstasy|gras rauchen|kiffen|joint|cannabis|marihuana|weed|drugs?|cocaine|meth)\b/i,
  /\b(fick|ficken|hure|nutte|schlampe|fuck|bitch|whore|slut|porn|porno)\w*/i,
  /\b(umbringen|erschießen|abstechen|vergewaltig\w*|kill you|murder|rape)\b/i,
];

const LEAK_PATTERNS: RegExp[] = [
  new RegExp(PROMPT_CANARY, "i"),
  /(my|meine)\s+(system\s*prompt|instructions|anweisungen|regeln)\s+(are|say|lauten|sind|besagen)/i,
  /\bas an ai (language )?model\b|\bals ki[- ]?(sprach)?modell\b/i,
  /<\s*player_message/i,
];

export type OutputProblem = "blocked_topic" | "prompt_leak" | null;

/** Checks generated text against the hard content rules. Works on partial text too. */
export function checkOutput(text: string): OutputProblem {
  if (LEAK_PATTERNS.some((pattern) => pattern.test(text))) return "prompt_leak";
  if (BLOCKED_OUTPUT.some((pattern) => pattern.test(text))) return "blocked_topic";
  return null;
}

/** Keeps replies short: at most four sentences and the hard character cap. */
export function trimReply(reply: string): string {
  const cleaned = reply.replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?…]+[.!?…]+["'”»)]*|\S[^.!?…]*$/g) ?? [cleaned];
  return sentences.slice(0, 4).join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_REPLY_LENGTH);
}

const DEFLECTIONS: Record<Language, string[]> = {
  de: [
    "Haha, du stellst Fragen. Lass uns lieber über was Schönes reden, ja?",
    "Puh, da bin ich raus. Erzähl mir lieber, was dich heute hierher verschlägt.",
    "Na, darüber quatsch ich nicht. Aber sonst gern über alles andere!",
  ],
  en: [
    "Ha, the things you ask. Let's talk about something nicer, shall we?",
    "Oof, I'll pass on that one. Tell me what brings you here today instead.",
    "Nah, not my kind of topic. Happy to chat about anything else though!",
  ],
};

/** A friendly, in-character way out, used when input or output breaks the rules. */
export function deflection(language: Language, seed = 0): string {
  const options = DEFLECTIONS[language];
  return options[Math.abs(seed) % options.length];
}

const CONFUSED: Record<Language, string> = {
  de: "Entschuldige, ich war kurz abgelenkt. Was hast du gesagt?",
  en: "Sorry, I got distracted for a second. What did you say?",
};

/** Used when the model's answer cannot be parsed at all. */
export function confusedReply(language: Language): string {
  return CONFUSED[language];
}
