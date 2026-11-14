import { create } from "zustand";
import { PLACES } from "@/content/places";
import type { ItemId } from "@/lib/npc/schema";
import type { Experience } from "@/lib/places/schema";
import { getRepository } from "@/lib/storage/repository";

const ALL_EXPERIENCES = new Map<string, Experience>(
  PLACES.flatMap((place) => place.experiences.map((experience) => [experience.id, experience])),
);

export function getExperience(id: string): Experience | undefined {
  return ALL_EXPERIENCES.get(id);
}

interface AlbumState {
  hydrated: boolean;
  /** Ids of unlocked experiences, in the order they were collected. */
  unlocked: string[];
  /** Drinks and other small things the player carries. */
  inventory: ItemId[];
  /** The most recent unlock, shown as a toast until dismissed. */
  toast: Experience | null;
  hydrate: () => Promise<void>;
  unlock: (id: string) => void;
  addItem: (item: ItemId) => void;
  dismissToast: () => void;
}

export const useAlbum = create<AlbumState>((set, get) => ({
  hydrated: false,
  unlocked: [],
  inventory: [],
  toast: null,
  async hydrate() {
    if (get().hydrated) return;
    const repository = await getRepository();
    const [unlocked, inventory] = await Promise.all([
      repository.loadExperiences(),
      repository.loadInventory(),
    ]);
    // Keep anything unlocked while storage was still loading.
    set((state) => ({
      hydrated: true,
      unlocked: [...new Set([...unlocked, ...state.unlocked])],
      inventory: state.inventory.length > 0 ? state.inventory : inventory,
    }));
  },
  unlock(id) {
    const experience = getExperience(id);
    if (!experience || get().unlocked.includes(id)) return;
    set((state) => ({ unlocked: [...state.unlocked, id], toast: experience }));
    void getRepository().then((repository) => repository.unlockExperience(id));
  },
  addItem(item) {
    // One of each is enough: a second matcha replaces the first.
    const inventory = [...get().inventory.filter((owned) => owned !== item), item];
    set({ inventory });
    void getRepository().then((repository) => repository.saveInventory(inventory));
  },
  dismissToast() {
    set({ toast: null });
  },
}));
