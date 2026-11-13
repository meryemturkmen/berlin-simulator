import { create } from "zustand";
import { PLACES } from "@/content/places";

interface WorldState {
  placeId: string;
  /** "loading" from the moment a trip starts until the scene has rendered. */
  phase: "loading" | "playing";
  /** Index of the fact shown on the loading screen for this trip. */
  factIndex: number;
  travelTo: (placeId: string) => void;
  markReady: () => void;
}

export const useWorld = create<WorldState>((set, get) => ({
  placeId: PLACES[0].id,
  phase: "loading",
  factIndex: 0,
  travelTo(placeId) {
    if (placeId === get().placeId && get().phase === "playing") return;
    set((state) => ({ placeId, phase: "loading", factIndex: state.factIndex + 1 }));
  },
  markReady() {
    set({ phase: "playing" });
  },
}));
