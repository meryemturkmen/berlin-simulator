"use client";

import { useEffect, useId, useRef, useState } from "react";
import { runtime } from "@/game/runtime";
import { useChat, type ChatLine } from "@/game/store/chat";
import { useSettings } from "@/game/store/settings";
import type { MessageKey } from "@/lib/i18n/messages";
import { useT } from "@/lib/i18n/useT";
import { MAX_PLAYER_MESSAGE_LENGTH } from "@/lib/npc/schema";

function Line({ line, npcName }: { line: ChatLine; npcName: string }) {
  const t = useT();
  if (line.from === "notice") {
    return (
      <p
        data-testid="chat-notice"
        className="bg-sun/25 text-ink mx-auto max-w-[90%] rounded-xl px-3 py-2 text-center text-base"
      >
        {t(`chat.${line.text}` as MessageKey)}
      </p>
    );
  }
  const mine = line.from === "player";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      <span className="text-ink-soft mb-0.5 px-1 text-xs font-semibold">
        {mine ? t("chat.you") : npcName}
      </span>
      <p
        data-testid={mine ? "chat-player-line" : "chat-npc-line"}
        data-pending={line.pending ? "true" : "false"}
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-lg leading-snug text-pretty ${
          mine ? "bg-ink text-paper rounded-br-md" : "text-ink rounded-bl-md bg-white shadow-sm"
        }`}
      >
        {line.text || (
          <span
            className="text-ink-soft animate-pulse"
            aria-label={t("chat.typing", { name: npcName })}
          >
            …
          </span>
        )}
      </p>
    </div>
  );
}

/** Conversation with an NPC: a panel over the lower part of the screen. */
export function ChatOverlay() {
  const t = useT();
  const inputId = useId();
  const language = useSettings((state) => state.language);
  const npc = useChat((state) => state.npc);
  const lines = useChat((state) => state.lines);
  const busy = useChat((state) => state.busy);
  const send = useChat((state) => state.send);
  const close = useChat((state) => state.close);
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const npcId = npc?.id;
  useEffect(() => {
    if (!npcId) return;
    input.current?.focus({ preventScroll: true });
    // The panel docks right on wide screens and at the bottom on narrow ones;
    // shift the 3D view so both characters stay in sight.
    const wide = window.matchMedia("(min-width: 1024px)").matches;
    runtime.viewShift = wide ? { x: 0.16, y: 0 } : { x: 0, y: 0.24 };
    return () => {
      runtime.viewShift = { x: 0, y: 0 };
    };
  }, [npcId]);

  // Keep the newest text in view while it streams in.
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (!npcId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [npcId, close]);

  if (!npc) return null;

  const submit = (text: string) => {
    if (busy || !text.trim()) return;
    setDraft("");
    void send(text);
  };
  const playerHasSpoken = lines.some((line) => line.from === "player");

  return (
    <section
      data-ui
      data-testid="chat"
      role="dialog"
      aria-label={`${npc.name}, ${npc.role[language]}`}
      className="bg-paper/95 absolute inset-x-0 bottom-0 z-30 mx-auto flex max-h-[52dvh] w-full max-w-2xl flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(20,15,40,0.35)] backdrop-blur sm:bottom-4 sm:rounded-3xl lg:inset-x-auto lg:top-4 lg:right-4 lg:max-h-none lg:w-[26rem]"
    >
      <header className="border-ink/10 flex items-center justify-between border-b px-5 py-3">
        <div>
          <h2 className="font-display text-xl leading-tight font-semibold">{npc.name}</h2>
          <p className="text-ink-soft text-sm">{npc.role[language]}</p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label={t("chat.close")}
          className="border-ink/15 hover:bg-paper-dim size-11 rounded-full border bg-white text-xl"
        >
          ✕
        </button>
      </header>

      <div
        ref={log}
        role="log"
        aria-live="polite"
        className="min-h-24 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {lines.map((line) => (
          <Line key={line.id} line={line} npcName={npc.name} />
        ))}
      </div>

      {!playerHasSpoken && npc.suggestions[language].length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-2">
          {npc.suggestions[language].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => submit(suggestion)}
              className="border-ink/20 text-ink hover:bg-paper-dim min-h-11 shrink-0 rounded-full border bg-white px-4 text-base"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="border-ink/10 flex gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          {t("chat.inputLabel", { name: npc.name })}
        </label>
        <input
          ref={input}
          id={inputId}
          type="text"
          value={draft}
          maxLength={MAX_PLAYER_MESSAGE_LENGTH}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={t("chat.placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          className="border-ink/20 min-h-12 min-w-0 flex-1 rounded-full border bg-white px-5 text-lg"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="bg-coral-deep min-h-12 rounded-full px-6 text-lg font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {t("chat.send")}
        </button>
      </form>
      {draft.length > MAX_PLAYER_MESSAGE_LENGTH - 50 && (
        <p className="text-ink-soft px-5 pb-2 text-right text-xs tabular-nums">
          {draft.length}/{MAX_PLAYER_MESSAGE_LENGTH}
        </p>
      )}
    </section>
  );
}
