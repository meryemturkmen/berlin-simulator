import type { ChatMessage } from "@/lib/npc/prompt";
import type { LanguageModel } from "@/lib/npc/turn";
import type { ServerConfig } from "./config";

type QwenConfig = NonNullable<ServerConfig["qwen"]>;

const REQUEST_TIMEOUT_MS = 20_000;

interface CompletionOptions {
  stream: boolean;
  maxTokens: number;
  temperature: number;
  json: boolean;
}

/**
 * Minimal client for Qwen through the OpenAI-compatible chat completions API
 * of Alibaba Cloud Model Studio. Server only: it holds the API key.
 */
export function createQwenModel(
  config: QwenConfig,
  fetchImpl: typeof fetch = fetch,
): LanguageModel {
  async function request(
    messages: ChatMessage[],
    options: CompletionOptions,
    signal?: AbortSignal,
  ) {
    const send = (extras: Record<string, unknown>) =>
      fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: options.stream,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          ...extras,
        }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)])
          : AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

    // JSON mode and "no thinking" keep small talk fast and well-formed. Not every
    // model accepts both parameters, so a 400 is retried once without them.
    let response = await send({
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
      enable_thinking: false,
    });
    if (response.status === 400) response = await send({});
    if (!response.ok) throw new Error(`Qwen request failed with status ${response.status}`);
    return response;
  }

  return {
    async *stream(messages, signal) {
      const response = await request(
        messages,
        { stream: true, maxTokens: 260, temperature: 0.85, json: true },
        signal,
      );
      if (!response.body) throw new Error("Qwen response has no body");
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        // Server-sent events: one "data: {...}" line per chunk.
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) yield delta;
          } catch {
            // Ignore keep-alives and malformed lines.
          }
        }
      }
    },

    async complete(messages, signal) {
      const response = await request(
        messages,
        { stream: false, maxTokens: 140, temperature: 0.3, json: false },
        signal,
      );
      const body = await response.json();
      const content = body?.choices?.[0]?.message?.content;
      return typeof content === "string" ? content : "";
    },
  };
}
