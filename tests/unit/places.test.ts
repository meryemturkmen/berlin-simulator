import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLACES } from "@/content/places";
import { manifestSchema } from "@/lib/places/schema";
import { terrainHeight } from "@/lib/places/terrain";

const ASSETS = join(__dirname, "..", "..", "public", "assets", "places");

describe("terrainHeight", () => {
  const bumps = [{ x: 10, z: 0, radius: 20, height: -4 }];

  it("is flat outside every bump", () => {
    expect(terrainHeight(bumps, 40, 0)).toBe(0);
    expect(terrainHeight([], 3, 4)).toBe(0);
  });

  it("reaches the full height at the center and fades smoothly to the rim", () => {
    expect(terrainHeight(bumps, 10, 0)).toBeCloseTo(-4);
    expect(terrainHeight(bumps, 20, 0)).toBeCloseTo(-2);
    expect(terrainHeight(bumps, 29.99, 0)).toBeCloseTo(0, 3);
  });

  it("adds overlapping bumps", () => {
    const two = [...bumps, { x: 10, z: 0, radius: 10, height: 1 }];
    expect(terrainHeight(two, 10, 0)).toBeCloseTo(-3);
  });
});

describe.each(PLACES)("place $id", (place) => {
  const inside = (x: number, z: number) =>
    Math.abs(x) < place.halfSize && Math.abs(z) < place.halfSize;

  it("keeps spawn, seats, props and NPC spots inside the walkable square", () => {
    expect(inside(place.spawn.x, place.spawn.z)).toBe(true);
    for (const item of [...place.seats, ...place.props, ...place.npcs]) {
      expect(inside(item.x, item.z)).toBe(true);
    }
  });

  it("has unique experience ids prefixed with the place id", () => {
    const ids = place.experiences.map((experience) => experience.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith(`${place.id}_`)).toBe(true);
  });

  it("has a built GLB under the size budget and a valid manifest", () => {
    const glb = join(ASSETS, `${place.id}.glb`);
    expect(existsSync(glb), "run `pnpm assets:build`").toBe(true);
    expect(statSync(glb).size).toBeLessThan(5_000_000);

    const manifest = manifestSchema.parse(
      JSON.parse(readFileSync(join(ASSETS, `${place.id}.json`), "utf8")),
    );
    expect(manifest.id).toBe(place.id);
    expect(manifest.halfSize).toBe(place.halfSize);
    expect(manifest.stats.buildings).toBeGreaterThan(10);
    expect(manifest.stats.glbBytes).toBe(statSync(glb).size);

    // Aerial ground photo, kept small enough for a quick first load.
    expect(manifest.aerial).toBe(true);
    const photo = join(ASSETS, `${place.id}-ground.jpg`);
    expect(existsSync(photo)).toBe(true);
    expect(statSync(photo).size).toBeLessThan(1_500_000);
  });
});
