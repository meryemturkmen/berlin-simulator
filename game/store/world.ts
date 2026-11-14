import { z } from "zod";
import { create } from "zustand";
import { PLACES } from "@/content/places";
import { readLocal, writeLocal } from "@/lib/storage/local";

interface WorldState {
  placeId: string;
  /** "loading" from the moment a trip starts until the scene has rendered. */
  phase: "loading" | "playing";
  /** Index of the fact shown on the loading screen for this trip. */
  factIndex: number;
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  /** Which secondary panel is open, if any. */
  panel: "album" | "settings" | null;
  setPanel: (panel: "album" | "settings" | null) => void;
  travelTo: (placeId: string) => void;
  markReady: () => void;
}

const MIN_TRAVEL_MS = 1800;
/** 0 for the first load of a session, which should be as fast as possible. */
let loadingSince = 0;

const DEFAULT_PLACE = "goerli";

/** Where the session starts: `?place=` in the URL, else the last place visited. */
function initialPlace(): string {
  const known = (id: string | null | undefined) => PLACES.some((place) => place.id === id);
  if (typeof window === "undefined") return DEFAULT_PLACE;
  const requested = new URLSearchParams(window.location.search).get("place");
  if (known(requested)) return requested!;
  const last = readLocal("place", z.string());
  return known(last) ? last! : DEFAULT_PLACE;
}

export const useWorld = create<WorldState>((set, get) => ({
  placeId: initialPlace(),
  phase: "loading",
  factIndex: 0,
  mapOpen: false,
  setMapOpen(mapOpen) {
    set({ mapOpen, panel: null });
  },
  panel: null,
  setPanel(panel) {
    set({ panel, mapOpen: false });
  },
  travelTo(placeId) {
    if (placeId === get().placeId) {
      set({ mapOpen: false });
      return;
    }
    writeLocal("place", placeId);
    loadingSince = Date.now();
    set((state) => ({ placeId, phase: "loading", mapOpen: false, factIndex: state.factIndex + 1 }));
  },
  markReady() {
    // Keep the loading screen up long enough to read the fact after a trip.
    const remaining = Math.max(0, MIN_TRAVEL_MS - (Date.now() - loadingSince));
    const placeId = get().placeId;
    setTimeout(() => {
      if (get().placeId === placeId) set({ phase: "playing" });
    }, remaining);
  },
}));
