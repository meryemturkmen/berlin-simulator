import type { z } from "zod";

const PREFIX = "berlin-sim:v1:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Storage can be blocked (private mode, embedded frames). The game still runs, unsaved.
    return null;
  }
}

/** Reads and validates a JSON value. Returns null when missing, unreadable, or invalid. */
export function readLocal<T>(key: string, schema: z.ZodType<T>): T | null {
  const raw = storage()?.getItem(PREFIX + key);
  if (raw == null) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    storage()?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: losing a save is better than crashing the game.
  }
}

export function removeLocal(key: string): void {
  try {
    storage()?.removeItem(PREFIX + key);
  } catch {
    // See writeLocal.
  }
}
