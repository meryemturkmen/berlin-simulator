"use client";

import { useEffect, useState } from "react";
import { useInteraction } from "@/game/interact/registry";
import { daylight, formatClock } from "@/game/sky/daylight";
import { useAlbum } from "@/game/store/album";
import { useChat } from "@/game/store/chat";
import { usePlayer } from "@/game/store/player";
import { useWorld } from "@/game/store/world";
import { useSettings } from "@/game/store/settings";
import { useT } from "@/lib/i18n/useT";
import { useIsTouch } from "@/lib/useIsTouch";
import type { ItemId } from "@/lib/npc/schema";
import type { Place } from "@/lib/places/schema";
import { Joystick } from "./Joystick";

const ITEM_ICONS: Record<ItemId, string> = { matcha: "🍵", coffee: "☕" };

function Clock() {
  const [time, setTime] = useState(() => formatClock(daylight.hour));
  useEffect(() => {
    const timer = window.setInterval(() => setTime(formatClock(daylight.hour)), 500);
    return () => window.clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{time}</span>;
}

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  );
}

/** In-game overlay: place and time, the interaction prompt, touch controls. */
export function Hud({ place }: { place: Place }) {
  const t = useT();
  const isTouch = useIsTouch();
  const language = useSettings((state) => state.language);
  const active = useInteraction((state) => state.active);
  const seated = usePlayer((state) => state.seat !== null);
  const frozen = usePlayer((state) => state.frozen);
  const inventory = useAlbum((state) => state.inventory);

  const prompt = seated
    ? { label: t("interact.stand"), run: () => usePlayer.getState().stand() }
    : active
      ? {
          label: active.name ? `${t(active.label)}: ${active.name}` : t(active.label),
          run: active.onInteract,
        }
      : null;

  // E triggers whatever the prompt offers.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || isTyping(event.target)) return;
      if (event.code === "KeyM" && !useChat.getState().npc) {
        useWorld.getState().setMapOpen(!useWorld.getState().mapOpen);
        return;
      }
      if (event.code !== "KeyE") return;
      if (usePlayer.getState().frozen) return;
      // Otherwise the letter lands in the chat input that opens on this key press.
      event.preventDefault();
      if (usePlayer.getState().seat) usePlayer.getState().stand();
      else useInteraction.getState().active?.onInteract();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="bg-ink/60 pointer-events-none absolute top-3 left-3 rounded-2xl px-4 py-2 text-white backdrop-blur">
        <p data-testid="place-name" className="font-display text-lg leading-tight font-semibold">
          {place.name[language]}
        </p>
        <p className="text-sm text-white/85">
          {place.district[language]} · <Clock />
        </p>
        {inventory.length > 0 && (
          <p data-testid="inventory" className="mt-1 flex gap-2 text-sm">
            {inventory.map((item) => (
              <span key={item} className="rounded-full bg-white/20 px-2 py-0.5">
                {ITEM_ICONS[item]} {t(`item.${item}`)}
              </span>
            ))}
          </p>
        )}
      </div>

      {!frozen && (
        <div data-ui className="absolute top-3 right-3 flex gap-2">
          <button
            type="button"
            data-testid="open-map"
            onClick={() => useWorld.getState().setMapOpen(true)}
            className="text-ink flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-base font-semibold shadow-md backdrop-blur hover:bg-white"
          >
            <span aria-hidden="true">🗺️</span>
            {t("map.open")}
            {!isTouch && <kbd className="bg-ink/10 rounded px-1.5 text-xs font-bold">M</kbd>}
          </button>
        </div>
      )}

      {prompt && !frozen && (
        <button
          type="button"
          data-ui
          data-testid="interact-prompt"
          onClick={prompt.run}
          className="text-ink absolute bottom-[max(7rem,18dvh)] left-1/2 flex min-h-12 -translate-x-1/2 items-center gap-3 rounded-full bg-white/95 px-5 text-lg font-semibold shadow-xl"
        >
          {!isTouch && (
            <kbd className="bg-ink text-paper rounded-md px-2 py-0.5 text-sm font-bold">E</kbd>
          )}
          {prompt.label}
        </button>
      )}

      {isTouch && !frozen && <Joystick />}
    </>
  );
}
