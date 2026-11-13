import { detectLanguage } from "./language";
import { checkOutput, deflection } from "./guardrails";
import { appendExchange, offlineSummary, shouldSummarize } from "./memory";
import { mockReply, mockStream } from "./mock";
import { extractPartialReply, parseNpcReply } from "./parse";
import { buildChatMessages, buildSummaryMessages, type ChatMessage } from "./prompt";
import {
  EMPTY_MEMORY,
  MAX_SUMMARY_LENGTH,
  type ChatEvent,
  type ChatRequest,
  type Npc,
  type NpcMemory,
  type NpcReply,
} from "./schema";

/** The language model, reduced to the two calls a chat turn needs. */
export interface LanguageModel {
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<string>;
  complete(messages: ChatMessage[], signal?: AbortSignal): Promise<string>;
}

export interface TurnInput {
  npc: Npc;
  request: ChatRequest;
  /** Memory to use: from the database when available, otherwise from the client. */
  memory: NpcMemory;
  /** null runs the turn in mock mode. */
  model: LanguageModel | null;
  signal?: AbortSignal;
  /** Delay between mock chunks, 0 in tests. */
  mockDelayMs?: number;
}

/**
 * Runs one chat turn and yields events for the client:
 *   delta*  reply text as it streams in
 *   final   the validated reply (replaces whatever was streamed)
 *   memory  updated memory for this player and NPC
 * Model failures and rule violations never surface as errors: the NPC falls
 * back to a safe in-character line instead.
 */
export async function* runNpcTurn(input: TurnInput): AsyncGenerator<ChatEvent> {
  const { npc, request, model, signal } = input;
  const memory = input.memory ?? EMPTY_MEMORY;
  const language = detectLanguage(request.message, request.language);
  const safeFallback = (): NpcReply => ({
    reply: deflection(language, memory.turns),
    emotion: "thoughtful",
    action: null,
  });

  let chunks: AsyncIterable<string>;
  if (model) {
    chunks = model.stream(
      buildChatMessages({ npc, playerName: request.playerName, message: request.message, memory }),
      signal,
    );
  } else {
    chunks = mockStream(mockReply(npc, request.message, language, memory), input.mockDelayMs);
  }

  let raw = "";
  let shown = "";
  let reply: NpcReply | null = null;
  try {
    for await (const chunk of chunks) {
      raw += chunk;
      const partial = extractPartialReply(raw);
      if (partial.length <= shown.length) continue;
      // Stop streaming the moment the text breaks a content rule.
      if (checkOutput(partial)) {
        reply = safeFallback();
        break;
      }
      yield { type: "delta", text: partial.slice(shown.length) };
      shown = partial;
    }
  } catch {
    // Network or provider failure: degrade to whatever arrived, or a canned line.
    reply = shown.length > 20 ? null : parseNpcReply("", npc, language);
  }

  if (!reply) {
    reply = parseNpcReply(raw, npc, language);
    if (checkOutput(reply.reply)) reply = safeFallback();
  }
  yield { type: "final", ...reply };

  let nextMemory = appendExchange(memory, request.message, reply.reply);
  if (shouldSummarize(nextMemory) || !nextMemory.summary) {
    let summary = offlineSummary(request.playerName, nextMemory);
    if (model && shouldSummarize(nextMemory)) {
      try {
        const written = (
          await model.complete(buildSummaryMessages(npc, request.playerName, nextMemory), signal)
        )
          .replace(/\s+/g, " ")
          .trim();
        if (written && !checkOutput(written)) summary = written.slice(0, MAX_SUMMARY_LENGTH);
      } catch {
        // Keep the offline summary.
      }
    }
    nextMemory = { ...nextMemory, summary };
  }
  yield { type: "memory", memory: nextMemory };
}
