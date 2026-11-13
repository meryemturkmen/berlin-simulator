import type { NpcMemory } from "@/lib/npc/schema";
import type { LanguageModel } from "@/lib/npc/turn";
import { readServerConfig } from "./config";
import { anonymousKey } from "./identity";
import { createQwenModel } from "./qwen";
import { MemoryRateLimiter, type RateLimiter } from "./rateLimit";

export interface ChatUser {
  /** Stable key for rate limiting. */
  key: string;
  /** Verified account id, when the caller is signed in. */
  userId: string | null;
}

/** Server-side NPC memory. `load` returns null when nothing is stored server-side. */
export interface MemoryStore {
  load(user: ChatUser, npcId: string): Promise<NpcMemory | null>;
  save(user: ChatUser, npcId: string, memory: NpcMemory): Promise<void>;
}

export interface ChatServices {
  /** null means mock mode. */
  model: LanguageModel | null;
  rateLimiter: RateLimiter;
  memory: MemoryStore;
  identify(request: Request): Promise<ChatUser>;
}

/** Without a database the client keeps the memory and sends it along. */
const clientHeldMemory: MemoryStore = {
  async load() {
    return null;
  },
  async save() {},
};

let services: ChatServices | null = null;

/** Wires up the chat route from environment configuration, once per server instance. */
export function getChatServices(): ChatServices {
  if (services) return services;
  const config = readServerConfig();
  services = {
    model: config.qwen ? createQwenModel(config.qwen) : null,
    rateLimiter: new MemoryRateLimiter(config.rateLimit),
    memory: clientHeldMemory,
    async identify(request) {
      return { key: anonymousKey(request), userId: null };
    },
  };
  return services;
}
