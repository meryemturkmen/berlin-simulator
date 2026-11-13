"use client";

import { useEffect } from "react";
import { useAlbum } from "@/game/store/album";
import { daylight, isSunsetHour } from "@/game/sky/daylight";
import { usePlayer } from "@/game/store/player";
import { useSettings } from "@/game/store/settings";
import { useT } from "@/lib/i18n/useT";
import type { Place } from "@/lib/places/schema";

const SUNSET_SECONDS = 4;

/** Announces a freshly unlocked experience, and awards the sunset one for sitting through it. */
export function ExperienceToast({ place }: { place: Place }) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const toast = useAlbum((state) => state.toast);
  const dismiss = useAlbum((state) => state.dismissToast);
  const hydrate = useAlbum((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [toast, dismiss]);

  // Watching the sunset: sit anywhere in the place while the sun goes down.
  const sunsetId = place.experiences.find((experience) => experience.id.endsWith("_sunset"))?.id;
  useEffect(() => {
    if (!sunsetId) return;
    let watched = 0;
    const timer = window.setInterval(() => {
      const seated = usePlayer.getState().seat !== null;
      watched = seated && isSunsetHour(daylight.hour) ? watched + 1 : 0;
      if (watched >= SUNSET_SECONDS) useAlbum.getState().unlock(sunsetId);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sunsetId]);

  if (!toast) return null;
  return (
    <div
      role="status"
      data-testid="experience-toast"
      className="text-ink pointer-events-none absolute top-20 left-1/2 z-30 flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-2xl bg-white/95 px-5 py-3 shadow-xl"
    >
      <span className="text-3xl" aria-hidden="true">
        {toast.icon}
      </span>
      <span>
        <span className="text-coral-deep block text-xs font-bold tracking-wider uppercase">
          {t("album.unlocked")}
        </span>
        <span className="font-display block text-lg leading-tight font-semibold">
          {toast.title[language]}
        </span>
      </span>
    </div>
  );
}
