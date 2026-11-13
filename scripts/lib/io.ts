import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { placeSchema, type Place } from "../../lib/places/schema";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const RAW_DIR = join(ROOT, "data", "raw");
export const ASSET_DIR = join(ROOT, "public", "assets");

export function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

/** Loads every place definition, or only the ids given on the command line. */
export function loadPlaces(only: string[] = []): Place[] {
  const directory = join(ROOT, "content", "places");
  const places = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .map((file) => placeSchema.parse(JSON.parse(readFileSync(join(directory, file), "utf8"))));
  const selected = only.length > 0 ? places.filter((place) => only.includes(place.id)) : places;
  if (selected.length === 0) throw new Error(`No matching places for: ${only.join(", ")}`);
  return selected;
}

/** Place ids passed as plain arguments (anything that is not a --flag). */
export function placeArgs(): string[] {
  return process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/** fetch with a timeout and a descriptive client name, as open data services ask for. */
export async function download(url: string, timeoutMs = 120_000, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "berlin-simulator-asset-pipeline", ...init.headers },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response;
}

export function log(scope: string, message: string) {
  console.log(`[${scope}] ${message}`);
}

/** Runs `main` only when the calling module is the script being executed. */
export function runMain(metaUrl: string, main: () => Promise<void>) {
  if (metaUrl !== pathToFileURL(process.argv[1]).href) return;
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
