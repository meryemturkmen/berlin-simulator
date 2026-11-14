import { create } from "zustand";
import type { ActionId, Emotion } from "@/lib/npc/schema";

export interface NpcLiveState {
  emotion: Emotion;
  /** True while the NPC's reply is streaming in. */
  talking: boolean;
  /** Action being performed and when it ends (performance.now() milliseconds). */
  action: { id: ActionId; until: number } | null;
}

const IDLE: NpcLiveState = { emotion: "neutral", talking: false, action: null };

/** How long each action's animation plays, in milliseconds. */
const ACTION_DURATION: Partial<Record<ActionId, number>> = {
  wave: 2400,
  point_to_place: 2600,
  play_song: 9000,
  pet_dog: 4000,
  serve_matcha: 2600,
  serve_coffee: 2600,
  take_photo: 2600,
  draw_sketch: 4000,
  tell_story: 4000,
  show_window: 2600,
};

interface NpcStore {
  states: Record<string, NpcLiveState>;
  patch: (npcId: string, patch: Partial<NpcLiveState>) => void;
  perform: (npcId: string, action: ActionId) => void;
}

export const useNpcs = create<NpcStore>((set) => ({
  states: {},
  patch(npcId, patch) {
    set((store) => ({
      states: { ...store.states, [npcId]: { ...(store.states[npcId] ?? IDLE), ...patch } },
    }));
  },
  perform(npcId, action) {
    const duration = ACTION_DURATION[action] ?? 2000;
    const until = performance.now() + duration;
    // Clear the action when it is over, unless a newer one has replaced it.
    setTimeout(() => {
      set((store) => {
        const current = store.states[npcId];
        if (!current || current.action?.until !== until) return store;
        return { states: { ...store.states, [npcId]: { ...current, action: null } } };
      });
    }, duration);
    set((store) => ({
      states: {
        ...store.states,
        [npcId]: { ...(store.states[npcId] ?? IDLE), action: { id: action, until } },
      },
    }));
  },
}));

export function npcState(npcId: string): NpcLiveState {
  return useNpcs.getState().states[npcId] ?? IDLE;
}
