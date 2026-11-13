import { describe, expect, it } from "vitest";
import { MemoryRateLimiter, decide, windowStart } from "@/lib/server/rateLimit";

const limits = { perUserPerHour: 3, globalPerDay: 5 };

describe("decide", () => {
  it("allows messages below both limits and reports what is left", () => {
    expect(decide(0, 0, limits)).toEqual({ allowed: true, scope: null, remaining: 2 });
    expect(decide(2, 4, limits)).toEqual({ allowed: true, scope: null, remaining: 0 });
  });

  it("stops a user at the hourly limit", () => {
    expect(decide(3, 3, limits)).toEqual({ allowed: false, scope: "user", remaining: 0 });
  });

  it("stops everyone at the global daily limit", () => {
    expect(decide(0, 5, limits)).toMatchObject({ allowed: false, scope: "global" });
  });
});

describe("windowStart", () => {
  it("truncates to the UTC hour and day", () => {
    const now = new Date("2026-05-04T13:47:21.500Z");
    expect(windowStart(now, "hour").toISOString()).toBe("2026-05-04T13:00:00.000Z");
    expect(windowStart(now, "day").toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });
});

describe("MemoryRateLimiter", () => {
  const at = (iso: string) => new Date(iso);

  it("counts per user and resets with the next hour", async () => {
    const limiter = new MemoryRateLimiter({ perUserPerHour: 2, globalPerDay: 100 });
    expect((await limiter.consume("a", at("2026-05-04T10:05:00Z"))).allowed).toBe(true);
    expect((await limiter.consume("a", at("2026-05-04T10:30:00Z"))).allowed).toBe(true);
    expect(await limiter.consume("a", at("2026-05-04T10:59:59Z"))).toMatchObject({
      allowed: false,
      scope: "user",
    });
    // Another user is unaffected.
    expect((await limiter.consume("b", at("2026-05-04T10:59:59Z"))).allowed).toBe(true);
    // New hour, new allowance.
    expect((await limiter.consume("a", at("2026-05-04T11:00:00Z"))).allowed).toBe(true);
  });

  it("enforces the global daily cap across users and resets the next day", async () => {
    const limiter = new MemoryRateLimiter({ perUserPerHour: 10, globalPerDay: 3 });
    for (const user of ["a", "b", "c"]) {
      expect((await limiter.consume(user, at("2026-05-04T08:00:00Z"))).allowed).toBe(true);
    }
    expect(await limiter.consume("d", at("2026-05-04T23:00:00Z"))).toMatchObject({
      allowed: false,
      scope: "global",
    });
    expect((await limiter.consume("d", at("2026-05-05T00:00:01Z"))).allowed).toBe(true);
  });

  it("does not count rejected messages", async () => {
    const limiter = new MemoryRateLimiter({ perUserPerHour: 1, globalPerDay: 2 });
    const hour = at("2026-05-04T08:00:00Z");
    await limiter.consume("a", hour);
    await limiter.consume("a", hour); // rejected, must not use up global quota
    await limiter.consume("a", hour);
    expect((await limiter.consume("b", hour)).allowed).toBe(true);
  });
});
