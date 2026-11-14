"use client";

import { useEffect } from "react";
import { daylight } from "@/game/sky/daylight";
import { useNpcs } from "@/game/store/npcs";
import { useSettings } from "@/game/store/settings";
import type { Place } from "@/lib/places/schema";
import { ambient } from "./ambient";

/** Connects the ambient engine to the game: place, mute setting, time of day, songs. */
export function useAmbient(place: Place, active: boolean) {
  const muted = useSettings((state) => state.muted);

  useEffect(() => {
    const unlock = () => ambient.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      ambient.setPlace(null);
    };
  }, []);

  useEffect(() => ambient.setMuted(muted), [muted]);

  useEffect(() => {
    ambient.setPlace(active ? place.ambient : null);
  }, [place.ambient, active]);

  useEffect(() => {
    const timer = window.setInterval(() => ambient.setNight(daylight.uniforms.uNight.value), 2000);
    // The musician's song is audible, not just an emoji.
    const unsubscribe = useNpcs.subscribe((store, previous) => {
      for (const [id, live] of Object.entries(store.states)) {
        if (
          live.action?.id === "play_song" &&
          previous.states[id]?.action?.until !== live.action.until
        ) {
          ambient.playSong();
        }
      }
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, []);
}
