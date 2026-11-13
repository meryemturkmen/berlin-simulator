import { SaxesParser } from "saxes";
import type { Frame, Vec2 } from "./geo";
import { wgsToLocal } from "./geo";

export type Tags = Record<string, string>;

export interface OsmNode {
  id: string;
  position: Vec2;
  tags: Tags;
}

export interface OsmWay {
  id: string;
  points: Vec2[];
  closed: boolean;
  tags: Tags;
}

/** A polygon with optional holes, from a closed way or a multipolygon relation. */
export interface OsmArea {
  id: string;
  outer: Vec2[];
  holes: Vec2[][];
  tags: Tags;
}

export interface OsmData {
  /** Only nodes that carry tags (trees, benches, lamps). */
  nodes: OsmNode[];
  ways: OsmWay[];
  areas: OsmArea[];
}

interface RawRelation {
  id: string;
  members: { type: string; ref: string; role: string }[];
  tags: Tags;
}

/** Joins way fragments that share end nodes into closed rings. */
function assembleRings(fragments: string[][]): string[][] {
  const pending = fragments.filter((fragment) => fragment.length >= 2).map((f) => [...f]);
  const rings: string[][] = [];
  while (pending.length > 0) {
    const ring = pending.pop()!;
    let extended = true;
    while (ring[0] !== ring[ring.length - 1] && extended) {
      extended = false;
      for (let index = 0; index < pending.length; index++) {
        const candidate = pending[index];
        const tail = ring[ring.length - 1];
        if (candidate[0] === tail) {
          ring.push(...candidate.slice(1));
        } else if (candidate[candidate.length - 1] === tail) {
          ring.push(...candidate.reverse().slice(1));
        } else {
          continue;
        }
        pending.splice(index, 1);
        extended = true;
        break;
      }
    }
    if (ring.length >= 4 && ring[0] === ring[ring.length - 1]) rings.push(ring);
  }
  return rings;
}

/** Parses OSM XML (as returned by the OSM API and by Overpass with out:xml). */
export function parseOsm(xml: string, frame: Frame): OsmData {
  const nodePositions = new Map<string, Vec2>();
  const taggedNodes: OsmNode[] = [];
  const rawWays = new Map<string, { nodes: string[]; tags: Tags }>();
  const relations: RawRelation[] = [];

  type Open =
    | { kind: "node"; id: string; tags: Tags }
    | { kind: "way"; id: string; nodes: string[]; tags: Tags }
    | { kind: "relation"; id: string; members: RawRelation["members"]; tags: Tags };
  let open: Open | null = null;

  const parser = new SaxesParser();
  parser.on("opentag", (tag) => {
    const attributes = tag.attributes as Record<string, string>;
    switch (tag.name) {
      case "node":
        nodePositions.set(
          attributes.id,
          wgsToLocal(frame, Number(attributes.lat), Number(attributes.lon)),
        );
        open = { kind: "node", id: attributes.id, tags: {} };
        break;
      case "way":
        open = { kind: "way", id: attributes.id, nodes: [], tags: {} };
        break;
      case "relation":
        open = { kind: "relation", id: attributes.id, members: [], tags: {} };
        break;
      case "nd":
        if (open?.kind === "way") open.nodes.push(attributes.ref);
        break;
      case "member":
        if (open?.kind === "relation") {
          open.members.push({ type: attributes.type, ref: attributes.ref, role: attributes.role });
        }
        break;
      case "tag":
        if (open) open.tags[attributes.k] = attributes.v;
        break;
    }
  });
  parser.on("closetag", (tag) => {
    if (!open || tag.name !== open.kind) return;
    if (open.kind === "node") {
      if (Object.keys(open.tags).length > 0) {
        taggedNodes.push({ id: open.id, position: nodePositions.get(open.id)!, tags: open.tags });
      }
    } else if (open.kind === "way") {
      rawWays.set(open.id, { nodes: open.nodes, tags: open.tags });
    } else {
      relations.push({ id: open.id, members: open.members, tags: open.tags });
    }
    open = null;
  });
  parser.write(xml).close();

  const toPoints = (ids: string[]): Vec2[] =>
    ids.map((id) => nodePositions.get(id)).filter((point): point is Vec2 => point !== undefined);

  const ways: OsmWay[] = [];
  const areas: OsmArea[] = [];
  for (const [id, way] of rawWays) {
    const points = toPoints(way.nodes);
    if (points.length < 2) continue;
    const closed = way.nodes.length >= 4 && way.nodes[0] === way.nodes[way.nodes.length - 1];
    ways.push({ id, points, closed, tags: way.tags });
    if (closed && Object.keys(way.tags).length > 0) {
      areas.push({ id: `w${id}`, outer: points.slice(0, -1), holes: [], tags: way.tags });
    }
  }

  for (const relation of relations) {
    if (relation.tags.type !== "multipolygon") continue;
    const fragments = (role: string) =>
      relation.members
        .filter((member) => member.type === "way" && (member.role || "outer") === role)
        .map((member) => rawWays.get(member.ref)?.nodes)
        .filter((nodes): nodes is string[] => nodes !== undefined);
    const holes = assembleRings(fragments("inner")).map((ring) => toPoints(ring).slice(0, -1));
    for (const ring of assembleRings(fragments("outer"))) {
      // Holes are attached to every outer ring; triangulation ignores those outside it.
      areas.push({
        id: `r${relation.id}`,
        outer: toPoints(ring).slice(0, -1),
        holes,
        tags: relation.tags,
      });
    }
  }

  return { nodes: taggedNodes, ways, areas };
}
