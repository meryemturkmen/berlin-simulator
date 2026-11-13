import { avatarSchema, type AvatarConfig } from "@/game/avatar/schema";
import { readLocal, writeLocal } from "./local";

/**
 * Persistence for everything the player owns. The game only talks to this
 * interface, so the backing store (localStorage or Supabase) can be swapped.
 */
export interface PlayerRepository {
  readonly kind: "local" | "supabase";
  loadAvatar(): Promise<AvatarConfig | null>;
  saveAvatar(avatar: AvatarConfig): Promise<void>;
}

export const localRepository: PlayerRepository = {
  kind: "local",
  async loadAvatar() {
    return readLocal("avatar", avatarSchema);
  },
  async saveAvatar(avatar) {
    writeLocal("avatar", avatar);
  },
};

export function getRepository(): PlayerRepository {
  return localRepository;
}
