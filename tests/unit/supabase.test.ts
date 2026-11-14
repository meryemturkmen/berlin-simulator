import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, type AvatarConfig } from "@/game/avatar/schema";
import { EMPTY_MEMORY, type ItemId, type NpcMemory } from "@/lib/npc/schema";
import { MemoryRateLimiter } from "@/lib/server/rateLimit";
import { createChatServices } from "@/lib/server/services";
import {
  SHARED_ANONYMOUS_USER,
  SupabaseRateLimiter,
  createAdminClient,
  createIdentify,
  createMemoryStore,
} from "@/lib/server/supabase";
import type { PlayerRepository } from "@/lib/storage/repository";
import { ensureSession } from "@/lib/supabase/client";
import { createSupabaseRepository } from "@/lib/supabase/repository";

const URL_BASE = "https://project.supabase.test";
const USER = "3f6c1a0e-8a57-4c69-9d0b-1c2d3e4f5a6b";
const avatar: AvatarConfig = { ...DEFAULT_AVATAR, name: "Mer" };

interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
}

/** A fake Supabase HTTP API: records calls and answers from a handler. */
function fakeApi(handler: (call: Call) => { status?: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const call: Call = {
      method: init?.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    const { status = 200, body = null } = handler(call);
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

function memoryRepository(seed: Partial<{ avatar: AvatarConfig; experiences: string[] }> = {}) {
  const state = {
    avatar: seed.avatar ?? null,
    experiences: [...(seed.experiences ?? [])],
    memories: new Map<string, NpcMemory>(),
    inventory: [] as ItemId[],
  };
  const repository: PlayerRepository = {
    kind: "local",
    loadAvatar: async () => state.avatar,
    saveAvatar: async (value) => void (state.avatar = value),
    loadExperiences: async () => state.experiences,
    unlockExperience: async (id) => void state.experiences.push(id),
    loadMemory: async (npcId) => state.memories.get(npcId) ?? EMPTY_MEMORY,
    saveMemory: async (npcId, memory) => void state.memories.set(npcId, memory),
    loadInventory: async () => state.inventory,
    saveInventory: async (items) => void (state.inventory = items),
  };
  return { state, repository };
}

function playerRepository(handler: Parameters<typeof fakeApi>[0], local = memoryRepository()) {
  const api = fakeApi(handler);
  const supabase = createClient(URL_BASE, "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: api.fetchImpl },
  });
  return { ...api, local, repository: createSupabaseRepository(supabase, USER, local.repository) };
}

describe("Supabase player repository", () => {
  it("loads the avatar from the player's own profile row", async () => {
    const { repository, calls } = playerRepository(() => ({ body: { avatar_config: avatar } }));
    expect(await repository.loadAvatar()).toEqual(avatar);
    expect(calls[0].path).toBe("/rest/v1/profiles");
    expect(calls[0].query.get("id")).toBe(`eq.${USER}`);
  });

  it("falls back to the local avatar when the request fails", async () => {
    const local = memoryRepository({ avatar });
    const { repository } = playerRepository(
      () => ({ status: 500, body: { message: "down" } }),
      local,
    );
    expect(await repository.loadAvatar()).toEqual(avatar);
  });

  it("uploads a locally created avatar on the first signed-in visit", async () => {
    const local = memoryRepository({ avatar });
    const { repository, calls } = playerRepository(
      (call) => (call.method === "GET" ? { body: null } : { status: 201 }),
      local,
    );
    expect(await repository.loadAvatar()).toEqual(avatar);
    const upsert = calls.find((call) => call.method === "POST");
    expect(upsert?.body).toMatchObject({ id: USER, display_name: "Mer", avatar_config: avatar });
  });

  it("saves the avatar locally and remotely", async () => {
    const { repository, calls, local } = playerRepository(() => ({ status: 201 }));
    await repository.saveAvatar(avatar);
    expect(local.state.avatar).toEqual(avatar);
    expect(calls[0]).toMatchObject({ method: "POST", path: "/rest/v1/profiles" });
    expect(calls[0].headers.get("prefer")).toContain("resolution=merge-duplicates");
  });

  it("merges remote and offline experiences and pushes the missing ones", async () => {
    const local = memoryRepository({ experiences: ["goerli_song", "mitte_matcha"] });
    const { repository, calls } = playerRepository(
      (call) =>
        call.method === "GET" ? { body: [{ experience_id: "goerli_song" }] } : { status: 201 },
      local,
    );
    expect(await repository.loadExperiences()).toEqual(["goerli_song", "mitte_matcha"]);
    const push = calls.find((call) => call.method === "POST");
    expect(push?.body).toEqual([{ user_id: USER, experience_id: "mitte_matcha" }]);
  });

  it("unlocks experiences idempotently", async () => {
    const { repository, calls, local } = playerRepository(() => ({ status: 201 }));
    await repository.unlockExperience("kudamm_photo");
    expect(local.state.experiences).toEqual(["kudamm_photo"]);
    expect(calls[0].body).toEqual({ user_id: USER, experience_id: "kudamm_photo" });
    expect(calls[0].headers.get("prefer")).toContain("resolution=ignore-duplicates");
  });

  it("reads NPC memory written by the server and never writes it from the browser", async () => {
    const { repository, calls } = playerRepository(() => ({
      body: {
        summary: "Mer likes dogs.",
        last_messages: [{ role: "player", text: "Hi" }],
        turns: 4,
      },
    }));
    expect(await repository.loadMemory("micha")).toEqual({
      summary: "Mer likes dogs.",
      messages: [{ role: "player", text: "Hi" }],
      turns: 4,
    });
    expect(calls[0].query.get("npc_id")).toBe("eq.micha");
    await repository.saveMemory("micha", EMPTY_MEMORY);
    expect(calls).toHaveLength(1);
  });

  it("stores the inventory on the profile and tolerates bad data", async () => {
    const { repository, calls } = playerRepository((call) =>
      call.method === "GET" ? { body: { inventory: ["matcha", "sword"] } } : { status: 204 },
    );
    expect(await repository.loadInventory()).toEqual([]);
    await repository.saveInventory(["matcha"]);
    expect(calls.at(-1)).toMatchObject({ method: "PATCH", body: { inventory: ["matcha"] } });
  });
});

describe("anonymous session", () => {
  it("resolves to null without a client so callers use local storage", async () => {
    expect(await ensureSession(null)).toBeNull();
  });
});

describe("server-side Supabase access", () => {
  const config = { url: URL_BASE, anonKey: "anon", serviceRoleKey: "service-role" };
  const limits = { perUserPerHour: 30, globalPerDay: 2000 };

  it("identifies a caller from a valid bearer token", async () => {
    const { fetchImpl, calls } = fakeApi(() => ({
      body: { id: USER, aud: "authenticated", is_anonymous: true },
    }));
    const identify = createIdentify(createAdminClient(config, fetchImpl));
    const user = await identify(
      new Request("https://app.test/api", { headers: { Authorization: "Bearer good" } }),
    );
    expect(user).toEqual({ key: USER, userId: USER });
    expect(calls[0].path).toBe("/auth/v1/user");
    expect(calls[0].headers.get("authorization")).toBe("Bearer good");
  });

  it("treats a bad or missing token as an anonymous caller", async () => {
    const { fetchImpl } = fakeApi(() => ({ status: 401, body: { message: "invalid JWT" } }));
    const identify = createIdentify(createAdminClient(config, fetchImpl));
    const bad = await identify(
      new Request("https://app.test/api", { headers: { Authorization: "Bearer bad" } }),
    );
    const none = await identify(new Request("https://app.test/api"));
    expect(bad.userId).toBeNull();
    expect(bad.key).toMatch(/^anon:/);
    expect(none.userId).toBeNull();
  });

  it("consumes quota through the database function", async () => {
    const { fetchImpl, calls } = fakeApi(() => ({
      body: { allowed: true, scope: null, remaining: 29 },
    }));
    const limiter = new SupabaseRateLimiter(
      createAdminClient(config, fetchImpl),
      limits,
      new MemoryRateLimiter(limits),
    );
    expect(await limiter.consume(USER)).toEqual({ allowed: true, scope: null, remaining: 29 });
    expect(calls[0].path).toBe("/rest/v1/rpc/consume_chat_quota");
    expect(calls[0].body).toEqual({ p_user: USER, p_user_limit: 30, p_global_limit: 2000 });
    expect(calls[0].headers.get("apikey")).toBe("service-role");
  });

  it("puts callers without an account into one shared bucket", async () => {
    const { fetchImpl, calls } = fakeApi(() => ({
      body: { allowed: false, scope: "user", remaining: 0 },
    }));
    const limiter = new SupabaseRateLimiter(
      createAdminClient(config, fetchImpl),
      limits,
      new MemoryRateLimiter(limits),
    );
    expect((await limiter.consume("anon:abc123")).allowed).toBe(false);
    expect(calls[0].body).toMatchObject({ p_user: SHARED_ANONYMOUS_USER });
  });

  it("keeps limiting from memory when the database is unreachable", async () => {
    const { fetchImpl } = fakeApi(() => ({ status: 503, body: { message: "unavailable" } }));
    const tight = { perUserPerHour: 1, globalPerDay: 10 };
    const limiter = new SupabaseRateLimiter(
      createAdminClient(config, fetchImpl),
      tight,
      new MemoryRateLimiter(tight),
    );
    expect((await limiter.consume(USER)).allowed).toBe(true);
    expect((await limiter.consume(USER)).allowed).toBe(false);
  });

  it("loads and saves NPC memory for verified accounts only", async () => {
    const { fetchImpl, calls } = fakeApi((call) =>
      call.method === "GET"
        ? { body: { summary: "note", last_messages: [], turns: 2 } }
        : { status: 201 },
    );
    const store = createMemoryStore(createAdminClient(config, fetchImpl));
    const account = { key: USER, userId: USER };
    expect(await store.load(account, "jule")).toEqual({ summary: "note", messages: [], turns: 2 });
    await store.save(account, "jule", { summary: "new", messages: [], turns: 3 });
    expect(calls.at(-1)?.body).toMatchObject({
      user_id: USER,
      npc_id: "jule",
      summary: "new",
      turns: 3,
    });

    const before = calls.length;
    expect(await store.load({ key: "anon:x", userId: null }, "jule")).toBeNull();
    await store.save({ key: "anon:x", userId: null }, "jule", EMPTY_MEMORY);
    expect(calls).toHaveLength(before);
  });

  it("runs without Supabase when it is not configured", async () => {
    const services = createChatServices({ qwen: null, supabase: null, rateLimit: limits });
    expect(services.model).toBeNull();
    const user = await services.identify(new Request("https://app.test/api"));
    expect(user.userId).toBeNull();
    expect(await services.memory.load(user, "jule")).toBeNull();
    expect((await services.rateLimiter.consume(user.key)).allowed).toBe(true);
  });
});

describe("migrations", () => {
  const directory = join(__dirname, "..", "..", "supabase", "migrations");
  const sql = readdirSync(directory)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(join(directory, file), "utf8"))
    .join("\n");
  const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);

  it("creates the tables from the data model", () => {
    for (const table of ["profiles", "npc_memories", "experiences", "rate_limits"]) {
      expect(tables).toContain(table);
    }
  });

  it("enables row level security on every table", () => {
    for (const table of tables) {
      expect(sql, table).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("scopes every policy to the signed-in user and keeps the quota function private", () => {
    const policies = sql.match(/create policy[\s\S]*?;/g) ?? [];
    expect(policies.length).toBeGreaterThanOrEqual(6);
    for (const policy of policies) expect(policy).toContain("(select auth.uid())");
    expect(sql).not.toMatch(/create policy[^;]*on public\.(rate_limits|global_usage)/);
    expect(sql).toContain("revoke all on function public.consume_chat_quota");
  });
});
