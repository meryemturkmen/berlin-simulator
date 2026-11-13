import { create } from "zustand";
import type { MessageKey } from "@/lib/i18n/messages";

/** Something the player can walk up to and activate with E or a tap. */
export interface Interactable {
  id: string;
  position: [number, number, number];
  /** Activation distance in meters. */
  radius: number;
  /** Prompt text, e.g. "Sit down". */
  label: MessageKey;
  /** Optional name shown with the prompt (an NPC's name). */
  name?: string;
  /** Higher wins when several are in range (people before furniture). */
  priority: number;
  onInteract: () => void;
}

interface InteractionState {
  /** The interactable currently in range, shown as a prompt in the HUD. */
  active: Interactable | null;
  setActive: (active: Interactable | null) => void;
}

export const useInteraction = create<InteractionState>((set) => ({
  active: null,
  setActive: (active) => set({ active }),
}));

const interactables = new Map<string, Interactable>();

export function registerInteractables(items: Interactable[]): () => void {
  for (const item of items) interactables.set(item.id, item);
  return () => {
    for (const item of items) interactables.delete(item.id);
  };
}

/** Best interactable in range of a position, or null. */
export function findInteractable(x: number, y: number, z: number): Interactable | null {
  let best: Interactable | null = null;
  let bestScore = -Infinity;
  for (const item of interactables.values()) {
    const distance = Math.hypot(x - item.position[0], z - item.position[2]);
    if (distance > item.radius || Math.abs(y - item.position[1]) > 2.5) continue;
    const score = item.priority * 100 - distance;
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}
