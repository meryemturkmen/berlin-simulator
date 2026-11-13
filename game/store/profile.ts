import { create } from "zustand";
import type { AvatarConfig } from "@/game/avatar/schema";
import { getRepository } from "@/lib/storage/repository";

interface ProfileState {
  /** "loading" until the saved avatar has been read from storage. */
  status: "loading" | "ready";
  avatar: AvatarConfig | null;
  hydrate: () => Promise<void>;
  saveAvatar: (avatar: AvatarConfig) => Promise<void>;
}

export const useProfile = create<ProfileState>((set, get) => ({
  status: "loading",
  avatar: null,
  async hydrate() {
    if (get().status === "ready") return;
    const avatar = await getRepository().loadAvatar();
    set({ avatar, status: "ready" });
  },
  async saveAvatar(avatar) {
    set({ avatar, status: "ready" });
    await getRepository().saveAvatar(avatar);
  },
}));
