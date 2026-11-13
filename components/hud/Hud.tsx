"use client";

import { useEffect, useState } from "react";
import { useInteraction } from "@/game/interact/registry";
import { daylight, formatClock } from "@/game/sky/daylight";
import { usePlayer } from "@/game/store/player";
import { useSettings } from "@/game/store/settings";
import { useT } from "@/lib/i18n/useT";
import { useIsTouch } from "@/lib/useIsTouch";
import type { Place } from "@/lib/places/schema";
import { Joystick } from "./Joystick";

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
      if (event.code !== "KeyE" || event.repeat || isTyping(event.target)) return;
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
      </div>

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
