import { describe, expect, it } from "vitest";
import { DEFAULT_AVATAR, avatarSchema, randomLook, seededRandom } from "@/game/avatar/schema";

describe("avatar schema", () => {
  it("rejects the default avatar until a name is set", () => {
    expect(avatarSchema.safeParse(DEFAULT_AVATAR).success).toBe(false);
    expect(avatarSchema.safeParse({ ...DEFAULT_AVATAR, name: "Mer" }).success).toBe(true);
  });

  it("trims names and limits their length", () => {
    expect(avatarSchema.parse({ ...DEFAULT_AVATAR, name: "  Mer  " }).name).toBe("Mer");
    expect(avatarSchema.safeParse({ ...DEFAULT_AVATAR, name: "x".repeat(21) }).success).toBe(false);
    expect(avatarSchema.safeParse({ ...DEFAULT_AVATAR, name: "   " }).success).toBe(false);
  });

  it("rejects unknown options and malformed colors", () => {
    expect(avatarSchema.safeParse({ ...DEFAULT_AVATAR, name: "A", build: "giant" }).success).toBe(
      false,
    );
    expect(avatarSchema.safeParse({ ...DEFAULT_AVATAR, name: "A", skin: "red" }).success).toBe(
      false,
    );
  });

  it("generates valid, reproducible random looks", () => {
    const first = randomLook(seededRandom(42));
    const second = randomLook(seededRandom(42));
    expect(first).toEqual(second);
    for (let seed = 0; seed < 50; seed++) {
      const look = randomLook(seededRandom(seed));
      expect(avatarSchema.safeParse({ ...look, name: "Test" }).success).toBe(true);
    }
  });
});
