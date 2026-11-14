import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { memoryMessageSchema, type NpcMemory } from "@/lib/npc/schema";
import type { ServerConfig } from "./config";
import { anonymousKey } from "./identity";
import type { RateLimitResult, RateLimiter, RateLimits } from "./rateLimit";
import type { ChatUser, MemoryStore } from "./services";

type SupabaseConfig = NonNullable<ServerConfig["supabase"]>;

/** Callers without a valid session share this one bucket, so they cannot dodge the limit. */
export const SHARED_ANONYMOUS_USER = "00000000-0000-0000-0000-000000000000";

/**
 * Admin client with the service role key. Server only: it bypasses row level
 * security, so it must never be imported from client code.
 */
export function createAdminClient(
  config: SupabaseConfig,
  fetchImpl?: typeof fetch,
): SupabaseClient {
  return createClient(config.url, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: fetchImpl ? { fetch: fetchImpl } : undefined,
  });
}

/** Resolves the caller from the `Authorization: Bearer <token>` header. */
export function createIdentify(admin: SupabaseClient) {
  return async (request: Request): Promise<ChatUser> => {
    const header = request.headers.get("authorization") ?? "";
    const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    if (token) {
      try {
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data.user) return { key: data.user.id, userId: data.user.id };
      } catch {
        // Fall through to the anonymous bucket.
      }
    }
    return { key: anonymousKey(request), userId: null };
  };
}

const quotaSchema = z.object({
  allowed: z.boolean(),
  scope: z.enum(["user", "global"]).nullable(),
  remaining: z.number(),
});

/** Rate limiter backed by the `consume_chat_quota` database function. */
export class SupabaseRateLimiter implements RateLimiter {
  constructor(
    private readonly admin: SupabaseClient,
    private readonly limits: RateLimits,
    /** Used if the database cannot be reached, so an outage does not open the floodgates. */
    private readonly fallback: RateLimiter,
  ) {}

  async consume(userKey: string): Promise<RateLimitResult> {
    const isAccount = /^[0-9a-f-]{36}$/i.test(userKey);
    try {
      const { data, error } = await this.admin.rpc("consume_chat_quota", {
        p_user: isAccount ? userKey : SHARED_ANONYMOUS_USER,
        p_user_limit: this.limits.perUserPerHour,
        p_global_limit: this.limits.globalPerDay,
      });
      if (error) throw new Error(error.message);
      return quotaSchema.parse(data);
    } catch {
      return this.fallback.consume(userKey);
    }
  }
}

const messagesSchema = z.array(memoryMessageSchema).catch([]);

/** NPC memory in the `npc_memories` table, keyed by verified account. */
export function createMemoryStore(admin: SupabaseClient): MemoryStore {
  return {
    async load(user, npcId) {
      if (!user.userId) return null;
      const { data, error } = await admin
        .from("npc_memories")
        .select("summary, last_messages, turns")
        .eq("user_id", user.userId)
        .eq("npc_id", npcId)
        .maybeSingle();
      if (error || !data) return null;
      const memory: NpcMemory = {
        summary: String(data.summary ?? ""),
        messages: messagesSchema.parse(data.last_messages),
        turns: Number(data.turns) || 0,
      };
      return memory;
    },
    async save(user, npcId, memory) {
      if (!user.userId) return;
      await admin.from("npc_memories").upsert({
        user_id: user.userId,
        npc_id: npcId,
        summary: memory.summary,
        last_messages: memory.messages,
        turns: memory.turns,
        updated_at: new Date().toISOString(),
      });
    },
  };
}
