import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { avatarSchema } from "@/game/avatar/schema";
import { EMPTY_MEMORY, ITEM_IDS, memoryMessageSchema, type NpcMemory } from "@/lib/npc/schema";
import type { PlayerRepository } from "@/lib/storage/repository";

const inventorySchema = z.array(z.enum(ITEM_IDS)).catch([]);
const messagesSchema = z.array(memoryMessageSchema).catch([]);

/**
 * Player data in Supabase. Every query runs as the signed-in (anonymous)
 * user, so row level security limits it to that player's rows.
 *
 * Reads fall back to the local copy and writes are mirrored there, so a
 * network hiccup never loses progress and the game keeps working offline.
 */
export function createSupabaseRepository(
  supabase: SupabaseClient,
  userId: string,
  local: PlayerRepository,
): PlayerRepository {
  return {
    kind: "supabase",

    async loadAvatar() {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_config")
        .eq("id", userId)
        .maybeSingle();
      const remote = error ? null : avatarSchema.safeParse(data?.avatar_config);
      if (remote?.success) return remote.data;
      // First visit on this account: adopt an avatar created before sign-in worked.
      const cached = await local.loadAvatar();
      if (cached && !error && !data) await this.saveAvatar(cached);
      return cached;
    },

    async saveAvatar(avatar) {
      await local.saveAvatar(avatar);
      await supabase.from("profiles").upsert({
        id: userId,
        display_name: avatar.name,
        avatar_config: avatar,
        updated_at: new Date().toISOString(),
      });
    },

    async loadExperiences() {
      const cached = await local.loadExperiences();
      const { data, error } = await supabase
        .from("experiences")
        .select("experience_id")
        .eq("user_id", userId)
        .order("unlocked_at");
      if (error || !data) return cached;
      const remote = data.map((row) => String(row.experience_id));
      // Anything unlocked while offline is pushed up now.
      const missing = cached.filter((id) => !remote.includes(id));
      if (missing.length > 0) {
        await supabase.from("experiences").upsert(
          missing.map((experience_id) => ({ user_id: userId, experience_id })),
          { onConflict: "user_id,experience_id", ignoreDuplicates: true },
        );
      }
      return [...remote, ...missing];
    },

    async unlockExperience(id) {
      await local.unlockExperience(id);
      await supabase
        .from("experiences")
        .upsert(
          { user_id: userId, experience_id: id },
          { onConflict: "user_id,experience_id", ignoreDuplicates: true },
        );
    },

    async loadMemory(npcId) {
      const { data, error } = await supabase
        .from("npc_memories")
        .select("summary, last_messages, turns")
        .eq("user_id", userId)
        .eq("npc_id", npcId)
        .maybeSingle();
      if (error) return local.loadMemory(npcId);
      if (!data) return EMPTY_MEMORY;
      const memory: NpcMemory = {
        summary: String(data.summary ?? ""),
        messages: messagesSchema.parse(data.last_messages),
        turns: Number(data.turns) || 0,
      };
      return memory;
    },

    // The chat route stores memory with the service role; the browser only keeps a copy.
    async saveMemory(npcId, memory) {
      await local.saveMemory(npcId, memory);
    },

    async loadInventory() {
      const { data, error } = await supabase
        .from("profiles")
        .select("inventory")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return local.loadInventory();
      return inventorySchema.parse(data.inventory);
    },

    async saveInventory(items) {
      await local.saveInventory(items);
      await supabase.from("profiles").update({ inventory: items }).eq("id", userId);
    },
  };
}
