import { describe, expect, it } from "vitest";
import { getPlace } from "@/content/places";
import { tilesFor } from "@/scripts/fetch_lod2";
import { frameFor, pointInPolygon, utmToLocal, wgsBounds, wgsToUtm } from "@/scripts/lib/geo";
import {
  MeshBuilder,
  addRibbon,
  dashPolyline,
  ribbonEdges,
  triangulatePlanar,
} from "@/scripts/lib/mesh";
import { parseOsm } from "@/scripts/lib/osm";
import { osmBuildings } from "@/scripts/build_buildings";

const goerli = getPlace("goerli")!;

describe("geo", () => {
  it("projects WGS84 to UTM 33N", () => {
    const [east, north] = wgsToUtm(52.4966, 13.4371);
    expect(east).toBeCloseTo(393900.8, 0);
    expect(north).toBeCloseTo(5817421.9, 0);
  });

  it("puts east on +X and north on -Z", () => {
    const frame = frameFor(goerli);
    expect(utmToLocal(frame, frame.east + 10, frame.north + 20)).toEqual([10, -20]);
  });

  it("selects the LoD2 tiles that cover a place", () => {
    expect(tilesFor(goerli).sort()).toEqual(["LoD2_393_5817", "LoD2_394_5817"]);
  });

  it("computes a bounding box that contains the center", () => {
    const box = wgsBounds(goerli);
    expect(box.south).toBeLessThan(goerli.center.lat);
    expect(box.north).toBeGreaterThan(goerli.center.lat);
    expect(box.west).toBeLessThan(goerli.center.lon);
    expect(box.east).toBeGreaterThan(goerli.center.lon);
  });

  it("tests points against polygons", () => {
    const square: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ];
    expect(pointInPolygon(2, 2, square)).toBe(true);
    expect(pointInPolygon(5, 2, square)).toBe(false);
  });
});

describe("mesh helpers", () => {
  it("offsets a straight line by half the width on both sides", () => {
    const { left, right } = ribbonEdges(
      [
        [0, 0],
        [10, 0],
      ],
      4,
    );
    expect(Math.abs(left[0][1])).toBeCloseTo(2);
    expect(left[0][1]).toBeCloseTo(-right[0][1]);
  });

  it("emits upward-facing triangles for ribbons and clips them to the scene", () => {
    const mesh = new MeshBuilder("test");
    const options = { reach: 5, height: () => 0, lift: 0, maxEdge: 0 };
    addRibbon(
      mesh,
      [
        [-20, 0],
        [20, 0],
      ],
      2,
      [1, 1, 1],
      options,
    );
    expect(mesh.triangleCount).toBeGreaterThan(0);
    for (let i = 0; i < mesh.positions.length; i += 9) {
      const [ax, , az, bx, , bz, cx, , cz] = mesh.positions.slice(i, i + 9);
      const normalY = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      expect(normalY).toBeGreaterThan(0);
      for (const x of [ax, bx, cx]) expect(Math.abs(x)).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("cuts dashes of the requested length", () => {
    const dashes = dashPolyline(
      [
        [0, 0],
        [30, 0],
      ],
      3,
      6,
    );
    expect(dashes.length).toBe(4);
    for (const [from, to] of dashes) expect(to[0] - from[0]).toBeCloseTo(3);
  });

  it("triangulates a wall with horizontal u and keeps the outward normal", () => {
    const wall = triangulatePlanar([
      [0, 0, 0],
      [6, 0, 0],
      [6, 9, 0],
      [0, 9, 0],
    ])!;
    expect(wall.triangles).toHaveLength(2);
    expect(Math.abs(wall.normal[2])).toBeCloseTo(1);
    const us = wall.uv.map((uv) => uv[0]);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(6);
  });
});

describe("OSM parsing", () => {
  const xml = `<?xml version="1.0"?><osm>
    <node id="1" lat="52.4966" lon="13.4371"><tag k="natural" v="tree"/></node>
    <node id="2" lat="52.4967" lon="13.4371"/>
    <node id="3" lat="52.4967" lon="13.4373"/>
    <node id="4" lat="52.4966" lon="13.4373"/>
    <way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/>
      <tag k="building" v="yes"/><tag k="building:levels" v="5"/></way>
    <way id="11"><nd ref="1"/><nd ref="3"/><tag k="highway" v="footway"/></way>
    <way id="12"><nd ref="1"/><nd ref="2"/><nd ref="3"/></way>
    <way id="13"><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
    <relation id="20"><member type="way" ref="12" role="outer"/><member type="way" ref="13" role="outer"/>
      <tag k="type" v="multipolygon"/><tag k="leisure" v="park"/></relation>
  </osm>`;
  const data = parseOsm(xml, frameFor(goerli));

  it("keeps tagged nodes and converts to local meters", () => {
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0].tags.natural).toBe("tree");
    expect(Math.hypot(...data.nodes[0].position)).toBeLessThan(0.5);
  });

  it("distinguishes lines from closed areas", () => {
    expect(data.ways.find((way) => way.id === "11")?.closed).toBe(false);
    expect(data.areas.find((area) => area.id === "w10")?.outer).toHaveLength(4);
  });

  it("assembles multipolygon rings from way fragments", () => {
    const park = data.areas.find((area) => area.id === "r20");
    expect(park?.tags.leisure).toBe("park");
    expect(park?.outer).toHaveLength(4);
  });

  it("extrudes OSM footprints as the building fallback", () => {
    const [building] = osmBuildings(data, 200);
    expect(building.height).toBeCloseTo(5 * 3.2 + 1);
    expect(building.walls).toHaveLength(4);
    expect(building.roofs).toHaveLength(1);
  });
});
