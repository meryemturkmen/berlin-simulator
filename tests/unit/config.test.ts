import { describe, expect, it } from "vitest";
import { DEFAULT_QWEN_BASE_URL, DEFAULT_QWEN_MODEL, readServerConfig } from "@/lib/server/config";

describe("readServerConfig", () => {
  it("falls back to mock and local modes when keys are missing", () => {
    const config = readServerConfig({});
    expect(config.qwen).toBeNull();
    expect(config.supabase).toBeNull();
    expect(config.rateLimit).toEqual({ perUserPerHour: 30, globalPerDay: 2000 });
  });

  it("treats blank values as missing", () => {
    expect(readServerConfig({ QWEN_API_KEY: "   " }).qwen).toBeNull();
  });

  it("applies Qwen defaults and trims trailing slashes", () => {
    expect(readServerConfig({ QWEN_API_KEY: "k" }).qwen).toEqual({
      apiKey: "k",
      baseUrl: DEFAULT_QWEN_BASE_URL,
      model: DEFAULT_QWEN_MODEL,
    });
    expect(
      readServerConfig({ QWEN_API_KEY: "k", QWEN_BASE_URL: "https://example.test/v1/" }).qwen
        ?.baseUrl,
    ).toBe("https://example.test/v1");
  });

  it("requires all three Supabase values", () => {
    const partial = readServerConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(partial.supabase).toBeNull();
  });

  it("ignores invalid rate limit numbers", () => {
    const config = readServerConfig({
      RATE_LIMIT_PER_HOUR: "abc",
      RATE_LIMIT_GLOBAL_PER_DAY: "-4",
    });
    expect(config.rateLimit).toEqual({ perUserPerHour: 30, globalPerDay: 2000 });
  });
});
