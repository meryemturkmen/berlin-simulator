"use client";

import { useProgress } from "@react-three/drei";
import { useSettings } from "@/game/store/settings";
import { useT } from "@/lib/i18n/useT";
import type { Place } from "@/lib/places/schema";

/** Full-screen cover while a place loads: where you are going, plus a Berlin fact. */
export function LoadingScreen({
  place,
  factIndex,
  visible,
}: {
  place: Place;
  factIndex: number;
  visible: boolean;
}) {
  const t = useT();
  const language = useSettings((state) => state.language);
  const progress = useProgress((state) => state.progress);
  const fact = place.facts[factIndex % place.facts.length];

  return (
    <div
      data-ui
      data-testid="loading-screen"
      aria-hidden={!visible}
      className={`from-dusk absolute inset-0 z-40 flex flex-col items-center justify-center bg-linear-to-b to-[#b5607a] px-6 text-center text-white transition-opacity duration-500 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <p className="text-sm font-semibold tracking-[0.25em] text-[#ffd9a8] uppercase">
        {t("hud.arriving")} {place.district[language]}
      </p>
      <h2 className="font-display mt-2 text-4xl font-semibold sm:text-6xl">
        {place.name[language]}
      </h2>
      <div
        role="progressbar"
        aria-label={t("hud.loading")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-white/25"
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300"
          style={{ width: `${Math.max(8, progress)}%` }}
        />
      </div>
      <div className="mt-10 max-w-md">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/70 uppercase">
          {t("hud.didYouKnow")}
        </p>
        <p className="mt-2 text-lg text-pretty text-white/95">{fact[language]}</p>
      </div>
    </div>
  );
}
