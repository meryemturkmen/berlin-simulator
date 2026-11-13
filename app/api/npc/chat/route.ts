import { getNpc } from "@/content/npcs";
import { chatRequestSchema, EMPTY_MEMORY, type ChatEvent } from "@/lib/npc/schema";
import { runNpcTurn } from "@/lib/npc/turn";
import { getChatServices } from "@/lib/server/services";

export const maxDuration = 30;

function line(event: ChatEvent): string {
  return `${JSON.stringify(event)}\n`;
}

function errorResponse(code: Extract<ChatEvent, { type: "error" }>["code"], status: number) {
  return new Response(line({ type: "error", code }), {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * One chat turn with an NPC. Streams newline-delimited JSON events
 * (see ChatEvent). The Qwen key never leaves the server; without a key the
 * turn is answered by the local mock.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 400);
  }
  const parsed = chatRequestSchema.safeParse(body);
  const npc = parsed.success ? getNpc(parsed.data.npcId) : undefined;
  if (!parsed.success || !npc) return errorResponse("bad_request", 400);

  const services = getChatServices();
  const user = await services.identify(request);
  const quota = await services.rateLimiter.consume(user.key);
  if (!quota.allowed) {
    return errorResponse(
      quota.scope === "global" ? "rate_limited_global" : "rate_limited_user",
      429,
    );
  }

  // Server-held memory wins; the client copy is only used when nothing is stored server-side.
  const stored = await services.memory.load(user, npc.id);
  const memory = stored ?? parsed.data.memory ?? EMPTY_MEMORY;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let status = "ok";
      try {
        for await (const event of runNpcTurn({
          npc,
          request: parsed.data,
          memory,
          model: services.model,
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(line(event)));
          if (event.type === "memory") await services.memory.save(user, npc.id, event.memory);
        }
      } catch {
        status = "failed";
        controller.enqueue(encoder.encode(line({ type: "error", code: "unavailable" })));
      } finally {
        controller.close();
        // Operational log only: no message text, no names, no addresses.
        console.info(
          JSON.stringify({
            event: "npc_chat",
            npc: npc.id,
            mode: services.model ? "qwen" : "mock",
            status,
            ms: Date.now() - started,
          }),
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
