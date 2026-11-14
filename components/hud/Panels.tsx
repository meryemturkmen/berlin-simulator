"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { PLACES } from "@/content/places";
import { useAlbum } from "@/game/store/album";
import { useChat } from "@/game/store/chat";
import { usePlayer } from "@/game/store/player";
import { QUALITY_LEVELS, useSettings, type Quality } from "@/game/store/settings";
import { useWorld } from "@/game/store/world";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/useT";
import { useIsTouch } from "@/lib/useIsTouch";

function Panel({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  const t = useT();
  const setPanel = useWorld((state) => state.setPanel);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    usePlayer.getState().setFrozen(true);
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (!useChat.getState().npc) usePlayer.getState().setFrozen(false);
    };
  }, [setPanel]);

  return (
    <div
      data-ui
      className="bg-dusk/60 absolute inset-0 z-40 flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) setPanel(null);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        className="bg-paper text-ink flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl shadow-2xl sm:rounded-3xl"
      >
        <header className="border-ink/10 flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display text-2xl font-semibold">{title}</h2>
          <button
            ref={close}
            type="button"
            onClick={() => setPanel(null)}
            aria-label={t("common.close")}
            className="border-ink/15 hover:bg-paper-dim size-11 rounded-full border bg-white text-xl"
          >
            ✕
          </button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </section>
    </div>
  );
}

/** The Berlin album: every experience, grouped by place, collected or still open. */
function Album() {
  const t = useT();
  const language = useSettings((state) => state.language);
  const unlocked = useAlbum((state) => state.unlocked);
  const total = PLACES.reduce((sum, place) => sum + place.experiences.length, 0);
  const count = PLACES.reduce(
    (sum, place) =>
      sum + place.experiences.filter((experience) => unlocked.includes(experience.id)).length,
    0,
  );

  return (
    <Panel title={t("album.title")} testId="album">
      <p data-testid="album-progress" className="text-ink-soft text-base">
        {t("album.progress", { count, total })}
      </p>
      <div
        className="bg-ink/10 mt-2 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
        aria-label={t("album.title")}
      >
        <div
          className="bg-coral h-full rounded-full"
          style={{ width: `${(count / total) * 100}%` }}
        />
      </div>

      {PLACES.map((place) => (
        <div key={place.id} className="mt-6">
          <h3 className="font-display text-xl font-semibold">
            {place.name[language]}
            <span className="text-ink-soft ml-2 font-sans text-sm font-medium">
              {place.district[language]}
            </span>
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {place.experiences.map((experience) => {
              const have = unlocked.includes(experience.id);
              return (
                <li
                  key={experience.id}
                  data-unlocked={have}
                  className={`flex items-start gap-3 rounded-2xl border p-3 ${
                    have ? "border-ink/10 bg-white" : "border-ink/15 border-dashed bg-transparent"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-11 shrink-0 place-items-center rounded-xl text-2xl ${
                      have ? "bg-sun/30" : "bg-ink/5 grayscale"
                    }`}
                  >
                    {have ? experience.icon : "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base leading-tight font-semibold">
                      {have ? experience.title[language] : t("album.locked")}
                    </span>
                    <span className="text-ink-soft block text-sm">
                      {have ? experience.description[language] : t("album.lockedHint")}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </Panel>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-b py-4">
      <span className="text-base font-semibold">{label}</span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="border-ink/15 inline-flex rounded-full border bg-white p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-full px-3 text-sm font-semibold transition-colors ${
            value === option.value ? "bg-ink text-paper" : "text-ink-soft hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Settings({ qualityLevel }: { qualityLevel: Quality }) {
  const t = useT();
  const isTouch = useIsTouch();
  const muted = useSettings((state) => state.muted);
  const quality = useSettings((state) => state.quality);
  const setMuted = useSettings((state) => state.setMuted);
  const setQuality = useSettings((state) => state.setQuality);
  const qualityLabel = (level: "auto" | Quality) => t(`settings.quality.${level}` as MessageKey);

  return (
    <Panel title={t("settings.title")} testId="settings">
      <Row label={t("common.language")}>
        <LanguageToggle />
      </Row>
      <Row label={t("settings.sound")}>
        <Segmented
          label={t("settings.sound")}
          value={muted ? "off" : "on"}
          onChange={(value) => setMuted(value === "off")}
          options={[
            { value: "on", label: t("settings.soundOn") },
            { value: "off", label: t("settings.soundOff") },
          ]}
        />
      </Row>
      <Row label={t("settings.quality")}>
        <div className="flex flex-col items-end gap-1">
          <Segmented
            label={t("settings.quality")}
            value={quality}
            onChange={setQuality}
            options={(["auto", ...QUALITY_LEVELS] as const).map((level) => ({
              value: level,
              label: qualityLabel(level),
            }))}
          />
          {quality === "auto" && (
            <span className="text-ink-soft text-xs">
              {t("settings.qualityNow", { level: qualityLabel(qualityLevel) })}
            </span>
          )}
        </div>
      </Row>
      <div className="py-4">
        <p className="text-base font-semibold">{t("settings.controls")}</p>
        <p className="text-ink-soft mt-1 text-sm leading-relaxed">
          {t(isTouch ? "settings.controlsTouch" : "settings.controlsList")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 pt-1 pb-2">
        <Link
          href="/avatar"
          className="border-ink/20 hover:bg-paper-dim inline-flex min-h-11 items-center rounded-full border bg-white px-5 font-semibold"
        >
          {t("settings.changeAvatar")}
        </Link>
        <Link
          href="/"
          className="border-ink/20 hover:bg-paper-dim inline-flex min-h-11 items-center rounded-full border bg-white px-5 font-semibold"
        >
          {t("settings.toTitle")}
        </Link>
        <Link
          href="/about"
          className="border-ink/20 hover:bg-paper-dim inline-flex min-h-11 items-center rounded-full border bg-white px-5 font-semibold"
        >
          {t("title.about")}
        </Link>
      </div>
    </Panel>
  );
}

/** Album and settings, whichever is open. */
export function Panels({ qualityLevel }: { qualityLevel: Quality }) {
  const panel = useWorld((state) => state.panel);
  if (panel === "album") return <Album />;
  if (panel === "settings") return <Settings qualityLevel={qualityLevel} />;
  return null;
}
