import type { Place } from "./schema";

type Bump = Place["terrain"][number];

/**
 * Ground height at a point, in meters. Each bump is a smooth cosine dome, so
 * the surface is continuous and flat outside every bump's radius.
 * Shared by the asset pipeline (to shape the ground mesh) and the game (to
 * place props and characters).
 */
export function terrainHeight(bumps: readonly Bump[], x: number, z: number): number {
  let height = 0;
  for (const bump of bumps) {
    const distance = Math.hypot(x - bump.x, z - bump.z);
    if (distance >= bump.radius) continue;
    const t = distance / bump.radius;
    height += bump.height * 0.5 * (1 + Math.cos(Math.PI * t));
  }
  return height;
}
