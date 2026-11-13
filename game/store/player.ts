import { create } from "zustand";
import type { SitMode } from "@/game/avatar/AvatarModel";

export interface Seat {
  id: string;
  position: [number, number, number];
  /** Facing direction while seated, radians around Y. */
  heading: number;
  mode: Exclude<SitMode, "none">;
}

interface PlayerState {
  seat: Seat | null;
  /** True while a modal overlay (chat, map) owns the input. */
  frozen: boolean;
  sit: (seat: Seat) => void;
  stand: () => void;
  setFrozen: (frozen: boolean) => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  seat: null,
  frozen: false,
  sit: (seat) => set({ seat }),
  stand: () => set({ seat: null }),
  setFrozen: (frozen) => set({ frozen }),
}));
