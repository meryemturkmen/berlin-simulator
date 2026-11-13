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
  /** Seat id an NPC invited the player to; the scene resolves it to a position. */
  seatRequest: string | null;
  sit: (seat: Seat) => void;
  requestSeat: (seatId: string | null) => void;
  stand: () => void;
  setFrozen: (frozen: boolean) => void;
}

export const usePlayer = create<PlayerState>((set) => ({
  seat: null,
  frozen: false,
  seatRequest: null,
  sit: (seat) => set({ seat, seatRequest: null }),
  requestSeat: (seatRequest) => set({ seatRequest }),
  stand: () => set({ seat: null }),
  setFrozen: (frozen) => set({ frozen }),
}));
