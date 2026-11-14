import { z } from "zod";
import { avatarSchema, type AvatarConfig } from "@/game/avatar/schema";
import {
  EMPTY_MEMORY,
  ITEM_IDS,
  npcMemorySchema,
  type ItemId,
  type NpcMemory,
} from "@/lib/npc/schema";
import { readLocal, writeLocal } from "./local";

/**
 * Persistence for everything the player owns. The game only talks to this
 * interface, so the backing store (localStorage or Supabase) can be swapped.
 */
export interface PlayerRepository {
  readonly kind: "local" | "supabase";
  loadAvatar(): Promise<AvatarConfig | null>;
  saveAvatar(avatar: AvatarConfig): Promise<void>;
  /** Ids of unlocked experiences. */
  loadExperiences(): Promise<string[]>;
  unlockExperience(id: string): Promise<void>;
  /** What an NPC remembers about this player. */
  loadMemory(npcId: string): Promise<NpcMemory>;
  saveMemory(npcId: string, memory: NpcMemory): Promise<void>;
  loadInventory(): Promise<ItemId[]>;
  saveInventory(items: ItemId[]): Promise<void>;
}

const experienceListSchema = z.array(z.string().max(60)).max(200);
const inventorySchema = z.array(z.enum(ITEM_IDS)).max(20);

export const localRepository: PlayerRepository = {
  kind: "local",
  async loadAvatar() {
    return readLocal("avatar", avatarSchema);
  },
  async saveAvatar(avatar) {
    writeLocal("avatar", avatar);
  },
  async loadExperiences() {
    return readLocal("experiences", experienceListSchema) ?? [];
  },
  async unlockExperience(id) {
    const current = readLocal("experiences", experienceListSchema) ?? [];
    if (!current.includes(id)) writeLocal("experiences", [...current, id]);
  },
  async loadMemory(npcId) {
    return readLocal(`memory:${npcId}`, npcMemorySchema) ?? EMPTY_MEMORY;
  },
  async saveMemory(npcId, memory) {
    writeLocal(`memory:${npcId}`, memory);
  },
  async loadInventory() {
    return readLocal("inventory", inventorySchema) ?? [];
  },
  async saveInventory(items) {
    writeLocal("inventory", items);
  },
};

let repository: Promise<PlayerRepository> | null = null;

/**
 * The repository for this session: Supabase when it is configured and an
 * anonymous session could be opened, otherwise local storage. Decided once.
 */
export function getRepository(): Promise<PlayerRepository> {
  repository ??= (async () => {
    if (!isSupabaseConfigured()) return localRepository;
    const { getSupabase, ensureSession } = await import("@/lib/supabase/client");
    const supabase = getSupabase();
    const session = await ensureSession(supabase);
    if (!supabase || !session) return localRepository;
    const { createSupabaseRepository } = await import("@/lib/supabase/repository");
    return createSupabaseRepository(supabase, session.userId, localRepository);
  })();
  return repository;
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
