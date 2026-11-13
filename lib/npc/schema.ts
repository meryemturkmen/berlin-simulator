import { z } from "zod";
import { avatarSchema } from "@/game/avatar/schema";
import { localizedSchema } from "@/lib/places/schema";

export const EMOTIONS = ["neutral", "happy", "annoyed", "surprised", "thoughtful"] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** Every action an NPC can trigger. Each NPC only gets a subset. */
export const ACTION_IDS = [
  "wave",
  "point_to_place",
  "sit_down",
  "serve_matcha",
  "serve_coffee",
  "play_song",
  "pet_dog",
  "take_photo",
  "show_window",
  "tell_story",
] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export const ITEM_IDS = ["matcha", "coffee"] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export const MAX_PLAYER_MESSAGE_LENGTH = 300;
export const MAX_REPLY_LENGTH = 600;
export const MAX_MEMORY_MESSAGES = 12;
export const MAX_SUMMARY_LENGTH = 600;

const actionSchema = z.object({
  id: z.enum(ACTION_IDS),
  /** Tells the model when to use the action. Part of the system prompt. */
  when: z.string().min(1),
  /** Experience unlocked for the player when the action fires. */
  experience: z.string().optional(),
  /** Item placed in the player's inventory. */
  item: z.enum(ITEM_IDS).optional(),
  /** Seat (from the place definition) the player is moved to. */
  seat: z.string().optional(),
});
export type NpcAction = z.infer<typeof actionSchema>;

const mockRuleSchema = z.object({
  /** Lowercase keywords; the rule applies if the player's message contains any of them. */
  match: z.array(z.string().min(1)).min(1),
  reply: z.string().min(1),
  emotion: z.enum(EMOTIONS).default("neutral"),
  action: z.enum(ACTION_IDS).nullable().default(null),
});

const mockSchema = z.object({
  rules: z.array(mockRuleSchema),
  /** Used in rotation when no rule matches. */
  smalltalk: z.array(z.string().min(1)).min(2),
});

export const npcSchema = z
  .object({
    id: z.string().regex(/^[a-z_]+$/),
    name: z.string().min(1).max(20),
    age: z.number().int().min(18).max(95),
    /** Place id where the NPC lives. */
    location: z.string(),
    /** Short label for the UI, e.g. "Musician". */
    role: localizedSchema,
    /** Prompt fields are written in English; the NPC answers in the player's language. */
    personality: z.string().min(1),
    speechStyle: z.object({
      description: z.string().min(1),
      /** Strength of Berlin dialect: 0 none, 1 a hint, 2 noticeable, 3 strong. */
      dialect: z.number().int().min(0).max(3),
    }),
    /** What the person knows about the place. One fact per entry. */
    knowledge: z.array(z.string().min(1)).min(1),
    goals: z.array(z.string().min(1)).min(1),
    mood: z.string().min(1),
    /** Topics or behavior this character steers away from. */
    boundaries: z.array(z.string().min(1)),
    availableActions: z.array(actionSchema),
    appearance: avatarSchema.omit({ name: true }),
    /** Opening line when the chat opens. No model call needed. */
    greeting: localizedSchema,
    /** Opening line on later visits. `{name}` is the player's name. */
    greetingReturning: localizedSchema,
    /** Tap-to-send conversation starters. */
    suggestions: z.object({ de: z.array(z.string()).max(3), en: z.array(z.string()).max(3) }),
    /** Canned, in-character replies for mock mode (no API key). */
    mock: z.object({ de: mockSchema, en: mockSchema }),
  })
  .superRefine((npc, context) => {
    const allowed = new Set(npc.availableActions.map((action) => action.id));
    for (const language of ["de", "en"] as const) {
      for (const rule of npc.mock[language].rules) {
        if (rule.action && !allowed.has(rule.action)) {
          context.addIssue({
            code: "custom",
            message: `mock rule uses action "${rule.action}" that is not in availableActions`,
          });
        }
      }
    }
  });

export type Npc = z.infer<typeof npcSchema>;

/** What the model must return for every turn. */
export const npcReplySchema = z.object({
  reply: z.string().trim().min(1).max(2000),
  emotion: z.enum(EMOTIONS).catch("neutral"),
  action: z.string().nullable().catch(null),
});

export interface NpcReply {
  reply: string;
  emotion: Emotion;
  action: ActionId | null;
}

export const memoryMessageSchema = z.object({
  role: z.enum(["player", "npc"]),
  text: z.string().max(MAX_REPLY_LENGTH),
});
export type MemoryMessage = z.infer<typeof memoryMessageSchema>;

export const npcMemorySchema = z.object({
  summary: z.string().max(MAX_SUMMARY_LENGTH).default(""),
  messages: z.array(memoryMessageSchema).max(MAX_MEMORY_MESSAGES).default([]),
  /** Number of player messages so far. Drives when the summary is refreshed. */
  turns: z.number().int().min(0).default(0),
});
export type NpcMemory = z.infer<typeof npcMemorySchema>;

export const EMPTY_MEMORY: NpcMemory = { summary: "", messages: [], turns: 0 };

export const chatRequestSchema = z.object({
  npcId: z.string().max(40),
  message: z.string().trim().min(1).max(MAX_PLAYER_MESSAGE_LENGTH),
  playerName: z.string().trim().min(1).max(20),
  /** UI language, used as a tie-breaker when the message language is unclear. */
  language: z.enum(["de", "en"]),
  /** Client-held memory. Ignored when the server stores memory itself. */
  memory: npcMemorySchema.optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/** Newline-delimited JSON events streamed from the chat route. */
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "final"; reply: string; emotion: Emotion; action: ActionId | null }
  | { type: "memory"; memory: NpcMemory }
  | {
      type: "error";
      code: "rate_limited_user" | "rate_limited_global" | "unavailable" | "bad_request";
    };
