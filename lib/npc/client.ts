import type { ChatEvent, ChatRequest } from "./schema";

/**
 * Sends one chat turn and calls `onEvent` for every streamed event.
 * Resolves when the stream ends; network failures surface as an "error" event
 * so callers have a single code path.
 */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  options: { signal?: AbortSignal; headers?: Record<string, string> } = {},
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/npc/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(request),
      signal: options.signal,
    });
  } catch {
    if (!options.signal?.aborted) onEvent({ type: "error", code: "unavailable" });
    return;
  }
  if (!response.body) {
    onEvent({ type: "error", code: "unavailable" });
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const flush = (text: string) => {
    if (!text.trim()) return;
    try {
      onEvent(JSON.parse(text) as ChatEvent);
    } catch {
      // A torn or foreign line: skip it rather than break the conversation.
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += value;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        flush(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    }
    flush(buffer);
  } catch {
    if (!options.signal?.aborted) onEvent({ type: "error", code: "unavailable" });
  }
}
