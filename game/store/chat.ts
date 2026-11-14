import { create } from "zustand";
import { getNpc } from "@/content/npcs";
import { getPlace } from "@/content/places";
import { streamChat } from "@/lib/npc/client";
import {
  EMPTY_MEMORY,
  type ActionId,
  type Emotion,
  type Npc,
  type NpcMemory,
} from "@/lib/npc/schema";
import { getRepository } from "@/lib/storage/repository";
import { accessToken } from "@/lib/supabase/client";
import { runtime } from "@/game/runtime";
import { useAlbum } from "./album";
import { useNpcs } from "./npcs";
import { usePlayer } from "./player";
import { useProfile } from "./profile";
import { useSettings } from "./settings";

export interface ChatLine {
  id: number;
  from: "player" | "npc" | "notice";
  text: string;
  emotion?: Emotion;
  /** True while this NPC line is still streaming. */
  pending?: boolean;
}

export type ChatNotice = "rate_limited_user" | "rate_limited_global" | "unavailable";

interface ChatState {
  npc: Npc | null;
  lines: ChatLine[];
  busy: boolean;
  open: (npcId: string) => Promise<void>;
  close: () => void;
  send: (text: string) => Promise<void>;
}

let nextLineId = 1;
let memory: NpcMemory = EMPTY_MEMORY;
let abort: AbortController | null = null;

/** Applies what an NPC action does in the world: animation, items, seats, experiences. */
export function applyNpcAction(npc: Npc, actionId: ActionId) {
  const action = npc.availableActions.find((candidate) => candidate.id === actionId);
  if (!action) return;
  useNpcs.getState().perform(npc.id, actionId);
  if (action.item) useAlbum.getState().addItem(action.item);
  if (action.experience) useAlbum.getState().unlock(action.experience);
  if (action.seat) {
    const seat = getPlace(npc.location)?.seats.find((candidate) => candidate.id === action.seat);
    if (seat) usePlayer.getState().requestSeat(seat.id);
  }
}

export const useChat = create<ChatState>((set, get) => ({
  npc: null,
  lines: [],
  busy: false,

  async open(npcId) {
    const npc = getNpc(npcId);
    if (!npc || get().npc) return;
    usePlayer.getState().setFrozen(true);
    const spot = getPlace(npc.location)?.npcs.find((candidate) => candidate.npc === npc.id);
    runtime.focus = spot ? { x: spot.x, z: spot.z } : null;
    memory = await (await getRepository()).loadMemory(npc.id);
    const language = useSettings.getState().language;
    const playerName = useProfile.getState().avatar?.name ?? "";
    const greeting =
      memory.turns > 0
        ? npc.greetingReturning[language].replace("{name}", playerName)
        : npc.greeting[language];
    set({
      npc,
      busy: false,
      lines: [{ id: nextLineId++, from: "npc", text: greeting, emotion: "happy" }],
    });
    useNpcs.getState().patch(npc.id, { emotion: "happy" });
  },

  close() {
    abort?.abort();
    abort = null;
    const npc = get().npc;
    if (npc) useNpcs.getState().patch(npc.id, { talking: false, emotion: "neutral" });
    usePlayer.getState().setFrozen(false);
    runtime.focus = null;
    set({ npc: null, lines: [], busy: false });
  },

  async send(text) {
    const { npc, busy } = get();
    const message = text.trim();
    const avatar = useProfile.getState().avatar;
    if (!npc || busy || !message || !avatar) return;

    const replyId = nextLineId + 1;
    set((state) => ({
      busy: true,
      lines: [
        ...state.lines,
        { id: nextLineId++, from: "player", text: message },
        { id: nextLineId++, from: "npc", text: "", pending: true },
      ],
    }));
    const update = (patch: Partial<ChatLine>) =>
      set((state) => ({
        lines: state.lines.map((line) => (line.id === replyId ? { ...line, ...patch } : line)),
      }));
    useNpcs.getState().patch(npc.id, { talking: true });

    abort = new AbortController();
    let streamed = "";
    // Signed-in players are rate limited and remembered by account.
    const token = await accessToken();
    await streamChat(
      {
        npcId: npc.id,
        message,
        playerName: avatar.name,
        language: useSettings.getState().language,
        memory,
      },
      (event) => {
        // The chat may have been closed while the reply was on its way.
        if (get().npc?.id !== npc.id) return;
        switch (event.type) {
          case "delta":
            streamed += event.text;
            update({ text: streamed });
            break;
          case "final":
            update({ text: event.reply, emotion: event.emotion, pending: false });
            useNpcs.getState().patch(npc.id, { emotion: event.emotion, talking: false });
            if (event.action) applyNpcAction(npc, event.action);
            break;
          case "memory":
            memory = event.memory;
            void getRepository().then((repository) => repository.saveMemory(npc.id, event.memory));
            break;
          case "error":
            if (event.code === "bad_request")
              update({ from: "notice", text: "unavailable", pending: false });
            else update({ from: "notice", text: event.code, pending: false });
            break;
        }
      },
      { signal: abort.signal, headers: token ? { Authorization: `Bearer ${token}` } : undefined },
    );
    if (get().npc?.id === npc.id) {
      useNpcs.getState().patch(npc.id, { talking: false });
      // A stream that ended without a final event still must not leave a spinner behind.
      set((state) => ({
        busy: false,
        lines: state.lines.map((line) =>
          line.id === replyId && line.pending
            ? line.text
              ? { ...line, pending: false }
              : { ...line, from: "notice", text: "unavailable", pending: false }
            : line,
        ),
      }));
    }
  },
}));
