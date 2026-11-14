"use client";

import { useEffect, useRef } from "react";
import { PLACES } from "@/content/places";
import { preloadPlace } from "@/game/place/usePlaceAssets";
import { useChat } from "@/game/store/chat";
import { usePlayer } from "@/game/store/player";
import { useSettings } from "@/game/store/settings";
import { useWorld } from "@/game/store/world";
import { useT } from "@/lib/i18n/useT";
import { berlinMapSchema } from "@/lib/places/map";
import rawMap from "@/public/assets/map/berlin.json";

const map = berlinMapSchema.parse(rawMap);
const PADDING = 14;

/** Stylized map of Berlin's districts. Picking a place travels there. */
export function MapOverlay() {
  const t = useT();
  const language = useSettings((state) => state.language);
  const open = useWorld((state) => state.mapOpen);
  const current = useWorld((state) => state.placeId);
  const setMapOpen = useWorld((state) => state.setMapOpen);
  const travelTo = useWorld((state) => state.travelTo);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    usePlayer.getState().setFrozen(true);
    dialog.current?.querySelector<HTMLElement>("[data-current='true']")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (!useChat.getState().npc) usePlayer.getState().setFrozen(false);
    };
  }, [open, setMapOpen]);

  if (!open) return null;

  const go = (id: string) => {
    usePlayer.getState().stand();
    travelTo(id);
  };

  return (
    <div
      ref={dialog}
      data-ui
      data-testid="map"
      role="dialog"
      aria-modal="true"
      aria-label={t("map.title")}
      className="from-dusk absolute inset-0 z-40 flex flex-col overflow-y-auto bg-linear-to-b to-[#7a4a6e] text-white lg:flex-row lg:items-center lg:overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setMapOpen(false)}
        aria-label={t("common.close")}
        className="absolute top-3 right-3 z-10 size-11 rounded-full bg-white/15 text-xl hover:bg-white/25"
      >
        ✕
      </button>

      <div className="relative w-full shrink-0 p-4 lg:h-full lg:w-3/5 lg:p-10">
        <svg
          viewBox={`${-PADDING} ${-PADDING} ${map.width + PADDING * 2} ${map.height + PADDING * 2}`}
          role="img"
          aria-label={t("map.label")}
          className="h-auto max-h-[44dvh] w-full lg:max-h-full"
        >
          {map.districts.map((district) => (
            <path
              key={district.name}
              d={district.path}
              fill={
                PLACES.some((place) => district.name.includes(place.district.de))
                  ? "#f3d9b8"
                  : "#e9dcc9"
              }
              fillOpacity={
                PLACES.some((place) => district.name.includes(place.district.de)) ? 0.95 : 0.55
              }
              stroke="#2b2a4c"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          ))}
          {map.districts.map((district) => (
            <text
              key={district.name}
              x={district.label[0]}
              y={district.label[1]}
              textAnchor="middle"
              fontSize="9.5"
              fill="#2b2a4c"
              fillOpacity="0.62"
              className="font-semibold select-none"
            >
              {district.name.split("-").map((part, index, parts) => (
                <tspan key={part} x={district.label[0]} dy={index === 0 ? 0 : 10}>
                  {part}
                  {index < parts.length - 1 ? "-" : ""}
                </tspan>
              ))}
            </text>
          ))}
          {map.places.map((marker) => {
            const here = marker.id === current;
            return (
              <g
                key={marker.id}
                transform={`translate(${marker.x} ${marker.y})`}
                aria-hidden="true"
              >
                <circle r={here ? 13 : 10} fill="#e4604a" fillOpacity="0.25">
                  <animate attributeName="r" values="9;15;9" dur="2.4s" repeatCount="indefinite" />
                </circle>
                <circle r="6" fill={here ? "#2b2a4c" : "#c44a36"} stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="w-full px-4 pb-8 lg:w-2/5 lg:pr-10">
        <h2 className="font-display text-3xl font-semibold lg:text-5xl">{t("map.title")}</h2>
        <p className="mt-1 text-base text-white/80">{t("map.subtitle")}</p>
        <ul className="mt-5 space-y-3">
          {PLACES.map((place) => {
            const here = place.id === current;
            return (
              <li key={place.id}>
                <button
                  type="button"
                  data-testid={`map-place-${place.id}`}
                  data-current={here}
                  onClick={() => go(place.id)}
                  onPointerEnter={() => preloadPlace(place.id)}
                  onFocus={() => preloadPlace(place.id)}
                  className="text-ink flex w-full items-center gap-4 rounded-2xl bg-white/95 px-5 py-4 text-left transition-transform hover:scale-[1.015]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-coral-deep block text-xs font-bold tracking-wider uppercase">
                      {place.district[language]}
                    </span>
                    <span className="font-display block text-xl leading-tight font-semibold">
                      {place.name[language]}
                    </span>
                    <span className="text-ink-soft block text-sm">{place.tagline[language]}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${
                      here ? "bg-ink/10 text-ink" : "bg-coral-deep text-white"
                    }`}
                  >
                    {here ? t("map.here") : t("map.travel")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
