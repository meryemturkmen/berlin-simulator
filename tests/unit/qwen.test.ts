import { describe, expect, it } from "vitest";
import { createQwenModel } from "@/lib/server/qwen";

const config = { apiKey: "test-key", baseUrl: "https://example.test/v1", model: "qwen-test" };

function sse(chunks: string[]): Response {
  const lines = chunks.map(
    (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
  );
  return new Response([...lines, "data: [DONE]\n\n"].join(""), { status: 200 });
}

describe("createQwenModel", () => {
  it("streams content deltas from the OpenAI-compatible endpoint", async () => {
    const requests: { url: string; init: RequestInit }[] = [];
    const model = createQwenModel(config, async (url, init) => {
      requests.push({ url: String(url), init: init! });
      return sse(['{"reply": "Hal', 'lo!"}']);
    });
    let text = "";
    for await (const chunk of model.stream([{ role: "user", content: "hi" }])) text += chunk;
    expect(text).toBe('{"reply": "Hallo!"}');

    expect(requests[0].url).toBe("https://example.test/v1/chat/completions");
    expect((requests[0].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    const body = JSON.parse(String(requests[0].init.body));
    expect(body).toMatchObject({
      model: "qwen-test",
      stream: true,
      response_format: { type: "json_object" },
      enable_thinking: false,
    });
  });

  it("retries once without optional parameters when the model rejects them", async () => {
    const bodies: Record<string, unknown>[] = [];
    const model = createQwenModel(config, async (_url, init) => {
      bodies.push(JSON.parse(String(init!.body)));
      return bodies.length === 1
        ? new Response("unsupported parameter", { status: 400 })
        : sse(["ok"]);
    });
    let text = "";
    for await (const chunk of model.stream([{ role: "user", content: "hi" }])) text += chunk;
    expect(text).toBe("ok");
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).not.toHaveProperty("response_format");
    expect(bodies[1]).not.toHaveProperty("enable_thinking");
  });

  it("throws on provider errors so the turn can fall back", async () => {
    const model = createQwenModel(config, async () => new Response("nope", { status: 500 }));
    await expect(model.complete([{ role: "user", content: "hi" }])).rejects.toThrow(/500/);
  });

  it("returns the message content for non-streaming calls", async () => {
    const model = createQwenModel(config, async () =>
      Response.json({ choices: [{ message: { content: "A short note." } }] }),
    );
    expect(await model.complete([{ role: "user", content: "summarize" }])).toBe("A short note.");
  });
});
