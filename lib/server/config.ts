import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== "" ? value.trim() : undefined));

const positiveInt = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const parsed = Number.parseInt(value ?? "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    });

const envSchema = z.object({
  QWEN_API_KEY: optionalString,
  QWEN_BASE_URL: optionalString,
  QWEN_MODEL: optionalString,
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  RATE_LIMIT_PER_HOUR: positiveInt(30),
  RATE_LIMIT_GLOBAL_PER_DAY: positiveInt(2000),
});

export const DEFAULT_QWEN_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
export const DEFAULT_QWEN_MODEL = "qwen-flash";

export interface ServerConfig {
  qwen: { apiKey: string; baseUrl: string; model: string } | null;
  supabase: { url: string; anonKey: string; serviceRoleKey: string } | null;
  rateLimit: { perUserPerHour: number; globalPerDay: number };
}

/**
 * Reads server-side configuration. Missing keys are not an error: they switch
 * the matching subsystem to its mock (NPC replies) or local (storage) mode.
 */
export function readServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const parsed = envSchema.parse(env);
  const supabaseComplete =
    parsed.NEXT_PUBLIC_SUPABASE_URL &&
    parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    parsed.SUPABASE_SERVICE_ROLE_KEY;

  return {
    qwen: parsed.QWEN_API_KEY
      ? {
          apiKey: parsed.QWEN_API_KEY,
          baseUrl: (parsed.QWEN_BASE_URL ?? DEFAULT_QWEN_BASE_URL).replace(/\/+$/, ""),
          model: parsed.QWEN_MODEL ?? DEFAULT_QWEN_MODEL,
        }
      : null,
    supabase: supabaseComplete
      ? {
          url: parsed.NEXT_PUBLIC_SUPABASE_URL!,
          anonKey: parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY!,
        }
      : null,
    rateLimit: {
      perUserPerHour: parsed.RATE_LIMIT_PER_HOUR,
      globalPerDay: parsed.RATE_LIMIT_GLOBAL_PER_DAY,
    },
  };
}
