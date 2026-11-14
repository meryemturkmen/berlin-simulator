import type { NpcMemory } from "@/lib/npc/schema";
import type { LanguageModel } from "@/lib/npc/turn";
import { readServerConfig, type ServerConfig } from "./config";
import { anonymousKey } from "./identity";
import { createQwenModel } from "./qwen";
import { MemoryRateLimiter, type RateLimiter } from "./rateLimit";
import {
  createAdminClient,
  createIdentify,
  createMemoryStore,
  SupabaseRateLimiter,
} from "./supabase";

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

/** Builds the chat route's dependencies from configuration. Exported for tests. */
export function createChatServices(config: ServerConfig): ChatServices {
  const model = config.qwen ? createQwenModel(config.qwen) : null;
  const memoryLimiter = new MemoryRateLimiter(config.rateLimit);
  if (!config.supabase) {
    return {
      model,
      rateLimiter: memoryLimiter,
      memory: clientHeldMemory,
      async identify(request) {
        return { key: anonymousKey(request), userId: null };
      },
    };
  }
  const admin = createAdminClient(config.supabase);
  return {
    model,
    rateLimiter: new SupabaseRateLimiter(admin, config.rateLimit, memoryLimiter),
    memory: createMemoryStore(admin),
    identify: createIdentify(admin),
  };
}

/** Wires up the chat route from environment configuration, once per server instance. */
export function getChatServices(): ChatServices {
  services ??= createChatServices(readServerConfig());
  return services;
}
