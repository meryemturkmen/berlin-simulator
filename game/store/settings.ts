import { z } from "zod";
import { create } from "zustand";
import { readLocal, writeLocal } from "@/lib/storage/local";

export const LANGUAGES = ["de", "en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const QUALITY_LEVELS = ["low", "medium", "high"] as const;
export type Quality = (typeof QUALITY_LEVELS)[number];

const savedSettingsSchema = z.object({
  language: z.enum(LANGUAGES).optional(),
  muted: z.boolean().optional(),
  /** "auto" picks a level from the device; anything else is a manual override. */
  quality: z.enum(["auto", ...QUALITY_LEVELS]).optional(),
});

interface SettingsState {
  language: Language;
  muted: boolean;
  quality: "auto" | Quality;
  hydrated: boolean;
  hydrate: () => void;
  setLanguage: (language: Language) => void;
  setMuted: (muted: boolean) => void;
  setQuality: (quality: "auto" | Quality) => void;
}

function persist(state: SettingsState) {
  writeLocal("settings", {
    language: state.language,
    muted: state.muted,
    quality: state.quality,
  });
}

export const useSettings = create<SettingsState>((set, get) => ({
  language: "de",
  muted: false,
  quality: "auto",
  hydrated: false,
  hydrate() {
    if (get().hydrated) return;
    const saved = readLocal("settings", savedSettingsSchema);
    const browserLanguage: Language =
      typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("de")
        ? "en"
        : "de";
    set({
      language: saved?.language ?? browserLanguage,
      muted: saved?.muted ?? false,
      quality: saved?.quality ?? "auto",
      hydrated: true,
    });
  },
  setLanguage(language) {
    set({ language });
    persist(get());
  },
  setMuted(muted) {
    set({ muted });
    persist(get());
  },
  setQuality(quality) {
    set({ quality });
    persist(get());
  },
}));
