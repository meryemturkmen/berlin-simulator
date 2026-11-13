import earcut from "earcut";
import type { Vec2, Vec3 } from "./geo";

/** sRGB hex color -> linear RGB in [0, 1], which is what glTF vertex colors use. */
export function hexToLinear(hex: string): Vec3 {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return [channel(1), channel(3), channel(5)];
}

export function scaleColor(color: Vec3, factor: number): Vec3 {
  return [
    Math.min(1, color[0] * factor),
    Math.min(1, color[1] * factor),
    Math.min(1, color[2] * factor),
  ];
}

/** Accumulates non-indexed triangles with per-vertex color and optional extra data. */
export class MeshBuilder {
  readonly positions: number[] = [];
  readonly colors: number[] = [];
  /** Optional vec4 per vertex (used for wall window layout on buildings). */
  readonly extras: number[] = [];

  constructor(
    readonly name: string,
    readonly withExtras = false,
  ) {}

  get triangleCount(): number {
    return this.positions.length / 9;
  }

  addTriangle(a: Vec3, b: Vec3, c: Vec3, color: Vec3, extras?: [number[], number[], number[]]) {
    this.positions.push(...a, ...b, ...c);
    this.colors.push(...color, ...color, ...color);
    if (this.withExtras) {
      const zero = [0, 0, 0, 0];
      this.extras.push(
        ...(extras?.[0] ?? zero),
        ...(extras?.[1] ?? zero),
        ...(extras?.[2] ?? zero),
      );
    }
  }
}

function newellNormal(ring: readonly Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1, z1] = ring[i];
    const [x2, y2, z2] = ring[(i + 1) % ring.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  const length = Math.hypot(nx, ny, nz) || 1;
  return [nx / length, ny / length, nz / length];
}

export interface PlanarTriangulation {
  normal: Vec3;
  /** Triangles as index triples into `vertices`, wound to face along `normal`. */
  triangles: [number, number, number][];
  vertices: Vec3[];
  /** In-plane coordinates: `u` runs horizontally along the surface. */
  uv: Vec2[];
}

/**
 * Triangulates a planar 3D polygon (with holes) by projecting it onto its own
 * plane. For walls the first plane axis is horizontal, so `uv[i][0]` measures
 * meters along the wall.
 */
export function triangulatePlanar(
  outer: readonly Vec3[],
  holes: readonly Vec3[][] = [],
): PlanarTriangulation | null {
  const normal = newellNormal(outer);
  // Horizontal axis in the plane; for (near) horizontal surfaces any axis works.
  let ax = normal[2];
  let az = -normal[0];
  const horizontalLength = Math.hypot(ax, az);
  if (horizontalLength < 1e-6) {
    ax = 1;
    az = 0;
  } else {
    ax /= horizontalLength;
    az /= horizontalLength;
  }
  // Second axis: normal x first axis.
  const bx = normal[1] * az;
  const by = normal[2] * ax - normal[0] * az;
  const bz = -normal[1] * ax;

  const vertices = [...outer, ...holes.flat()];
  const uv: Vec2[] = vertices.map(([x, y, z]) => [x * ax + z * az, x * bx + y * by + z * bz]);
  const holeIndices: number[] = [];
  let offset = outer.length;
  for (const hole of holes) {
    holeIndices.push(offset);
    offset += hole.length;
  }
  const indices = earcut(uv.flat(), holeIndices.length > 0 ? holeIndices : undefined, 2);
  if (indices.length === 0) return null;

  const triangles: [number, number, number][] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    const [pa, pb, pc] = [vertices[a], vertices[b], vertices[c]];
    const ux = pb[0] - pa[0];
    const uy = pb[1] - pa[1];
    const uz = pb[2] - pa[2];
    const vx = pc[0] - pa[0];
    const vy = pc[1] - pa[1];
    const vz = pc[2] - pa[2];
    const facing =
      (uy * vz - uz * vy) * normal[0] +
      (uz * vx - ux * vz) * normal[1] +
      (ux * vy - uy * vx) * normal[2];
    triangles.push(facing >= 0 ? [a, b, c] : [a, c, b]);
  }
  return { normal, triangles, vertices, uv };
}

/** Clips a convex polygon to the axis-aligned square |x|, |z| <= reach. */
function clipToSquare(polygon: Vec2[], reach: number): Vec2[] {
  const edges: [0 | 1, 1 | -1][] = [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
  ];
  let result = polygon;
  for (const [axis, sign] of edges) {
    if (result.length === 0) break;
    const input = result;
    result = [];
    const inside = (point: Vec2) => point[axis] * sign <= reach;
    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];
      if (inside(current) !== inside(previous)) {
        const t = (reach * sign - previous[axis]) / (current[axis] - previous[axis]);
        result.push([
          previous[0] + (current[0] - previous[0]) * t,
          previous[1] + (current[1] - previous[1]) * t,
        ]);
      }
      if (inside(current)) result.push(current);
    }
  }
  return result;
}

export interface GroundOptions {
  /** Half size of the square everything is clipped to. */
  reach: number;
  /** Ground height lookup. */
  height: (x: number, z: number) => number;
  /** Constant offset above the terrain. */
  lift: number;
  /** Triangles are split until no edge is longer than this (0 disables). */
  maxEdge: number;
  /** Limits splitting to regions that are not flat. Defaults to everywhere. */
  needsDetail?: (minX: number, maxX: number, minZ: number, maxZ: number) => boolean;
}

/** Adds a flat-lying triangle draped on the terrain: clipped, then subdivided as needed. */
export function addGroundTriangle(
  builder: MeshBuilder,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  color: Vec3,
  options: GroundOptions,
) {
  const clipped = clipToSquare([a, b, c], options.reach);
  for (let i = 1; i + 1 < clipped.length; i++) {
    emit(builder, clipped[0], clipped[i], clipped[i + 1], color, options, 0);
  }
}

function emit(
  builder: MeshBuilder,
  a: Vec2,
  b: Vec2,
  c: Vec2,
  color: Vec3,
  options: GroundOptions,
  depth: number,
) {
  // Keep triangles counter-clockwise seen from above so they face up.
  const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(cross) < 1e-6) return;
  if (cross > 0) [b, c] = [c, b];

  if (options.maxEdge > 0 && depth < 8) {
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const longest = Math.max(ab, bc, ca);
    const bumpy =
      !options.needsDetail ||
      options.needsDetail(
        Math.min(a[0], b[0], c[0]),
        Math.max(a[0], b[0], c[0]),
        Math.min(a[1], b[1], c[1]),
        Math.max(a[1], b[1], c[1]),
      );
    if (longest > options.maxEdge && bumpy) {
      // Split the longest edge at its midpoint.
      const [p, q, r] = longest === ab ? [a, b, c] : longest === bc ? [b, c, a] : [c, a, b];
      const mid: Vec2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      emit(builder, p, mid, r, color, options, depth + 1);
      emit(builder, mid, q, r, color, options, depth + 1);
      return;
    }
  }
  const lift = (point: Vec2): Vec3 => [
    point[0],
    options.height(point[0], point[1]) + options.lift,
    point[1],
  ];
  builder.addTriangle(lift(a), lift(b), lift(c), color);
}

/** Fills a polygon with holes (in X/Z) onto the terrain. */
export function addGroundPolygon(
  builder: MeshBuilder,
  outer: readonly Vec2[],
  holes: readonly Vec2[][],
  color: Vec3,
  options: GroundOptions,
) {
  const vertices = [...outer, ...holes.flat()];
  const holeIndices: number[] = [];
  let offset = outer.length;
  for (const hole of holes) {
    holeIndices.push(offset);
    offset += hole.length;
  }
  const indices = earcut(vertices.flat(), holeIndices.length > 0 ? holeIndices : undefined, 2);
  for (let i = 0; i < indices.length; i += 3) {
    addGroundTriangle(
      builder,
      vertices[indices[i]],
      vertices[indices[i + 1]],
      vertices[indices[i + 2]],
      color,
      options,
    );
  }
}

/** Left and right edge points of a ribbon along a polyline, with clamped miter joins. */
export function ribbonEdges(
  points: readonly Vec2[],
  width: number,
): { left: Vec2[]; right: Vec2[] } {
  const half = width / 2;
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const direction = (from: Vec2, to: Vec2): Vec2 => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz) || 1;
    return [dx / length, dz / length];
  };
  for (let i = 0; i < points.length; i++) {
    const before = i > 0 ? direction(points[i - 1], points[i]) : null;
    const after = i < points.length - 1 ? direction(points[i], points[i + 1]) : null;
    const d1 = before ?? after!;
    const d2 = after ?? before!;
    // Miter direction is the average of both segment normals.
    let nx = -(d1[1] + d2[1]);
    let nz = d1[0] + d2[0];
    const length = Math.hypot(nx, nz);
    if (length < 1e-6) {
      nx = -d1[1];
      nz = d1[0];
    } else {
      nx /= length;
      nz /= length;
    }
    const cosHalf = Math.max(0.5, nx * -d1[1] + nz * d1[0]);
    const reach = half / cosHalf;
    left.push([points[i][0] + nx * reach, points[i][1] + nz * reach]);
    right.push([points[i][0] - nx * reach, points[i][1] - nz * reach]);
  }
  return { left, right };
}

/** Adds a flat ribbon (road, path) along a polyline. */
export function addRibbon(
  builder: MeshBuilder,
  points: readonly Vec2[],
  width: number,
  color: Vec3,
  options: GroundOptions,
) {
  if (points.length < 2) return;
  const { left, right } = ribbonEdges(points, width);
  for (let i = 0; i + 1 < points.length; i++) {
    addGroundTriangle(builder, left[i], right[i], right[i + 1], color, options);
    addGroundTriangle(builder, left[i], right[i + 1], left[i + 1], color, options);
  }
}

/** Splits a polyline into dashes of `dash` meters separated by `gap` meters. */
export function dashPolyline(points: readonly Vec2[], dash: number, gap: number): Vec2[][] {
  const dashes: Vec2[][] = [];
  let travelled = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length === 0) continue;
    const period = dash + gap;
    let start = Math.ceil((travelled - dash) / period) * period - travelled;
    for (; start < length; start += period) {
      const from = Math.max(0, start);
      const to = Math.min(length, start + dash);
      if (to - from < 0.3) continue;
      const at = (t: number): Vec2 => [
        a[0] + ((b[0] - a[0]) * t) / length,
        a[1] + ((b[1] - a[1]) * t) / length,
      ];
      dashes.push([at(from), at(to)]);
    }
    travelled += length;
  }
  return dashes;
}
