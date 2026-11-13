import * as THREE from "three";
import { daylight } from "@/game/sky/daylight";

/**
 * Building material: flat-shaded pastel walls with procedural windows.
 * The asset pipeline stores a `_wall` attribute per vertex:
 *   x = meters along the wall, y = height above ground,
 *   z = wall width (0 on roofs), w = height of the wall's top edge.
 * The fragment shader lays out evenly spaced windows from that, darkens the
 * glass by day and lights a random subset warmly at night.
 */
export function createBuildingMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.92,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = daylight.uniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 _wall;\nvarying vec4 vWall;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWall = _wall;");

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uNight;
        varying vec4 vWall;
        float windowHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float litWindow = 0.0;
        {
          float wallWidth = vWall.z;
          float h = vWall.y;
          // Soft darkening toward the pavement grounds the buildings.
          diffuseColor.rgb *= mix(0.86, 1.0, smoothstep(0.0, 5.0, h));
          if (wallWidth > 2.2) {
            const float GROUND_FLOOR = 4.0;
            const float FLOOR = 3.3;
            float columns = max(1.0, floor(wallWidth / 2.8));
            float cellU = vWall.x / (wallWidth / columns);
            float column = floor(cellU);
            float fu = fract(cellU);
            float floors = floor((vWall.w - GROUND_FLOOR - 0.5) / FLOOR);
            float glass = 0.0;
            float row = -1.0;
            if (h < GROUND_FLOOR) {
              // Ground floor: tall shop and entrance openings.
              glass = step(0.14, fu) * step(fu, 0.86) * step(0.55, h) * step(h, 3.1);
              diffuseColor.rgb *= h < 0.45 ? 0.8 : 1.0;
            } else {
              float cellV = (h - GROUND_FLOOR) / FLOOR;
              row = floor(cellV);
              float fv = fract(cellV);
              if (row < floors) {
                glass = step(0.24, fu) * step(fu, 0.76) * step(0.2, fv) * step(fv, 0.74);
                // Light frame around each window.
                float frame = step(0.2, fu) * step(fu, 0.8) * step(0.16, fv) * step(fv, 0.78);
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.91, 0.86), (frame - glass) * 0.55);
              }
            }
            if (glass > 0.5) {
              float seed = windowHash(vec2(column + floor(wallWidth * 7.0), row + floor(vWall.w * 3.0)));
              vec3 glassColor = mix(vec3(0.16, 0.2, 0.27), vec3(0.3, 0.4, 0.5), fract(h * 0.31 + seed * 0.2));
              diffuseColor.rgb = glassColor;
              // Roughly four in ten windows are lit after dark.
              litWindow = step(0.6, seed) * uNight;
            }
          }
        }`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.74, 0.38) * litWindow * 1.4;`,
      );
  };
  material.customProgramCacheKey = () => "berlin-building";
  return material;
}

const NOISE_GLSL = /* glsl */ `
  float groundHash(vec2 p) {
    return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
  }
  float groundNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), f.x),
      mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
`;

// Daisies and grass tufts as tiny dots on a world-space grid, faded out with
// distance (by pixel footprint) so they never shimmer.
const MEADOW_GLSL = /* glsl */ `
  {
    float footprint = max(fwidth(vGroundXZ.x), fwidth(vGroundXZ.y));
    float near = 1.0 - smoothstep(0.02, 0.09, footprint);
    vec2 cell = floor(vGroundXZ * 2.2);
    vec2 local = fract(vGroundXZ * 2.2) - 0.5;
    float pick = groundHash(cell);
    vec2 jitter = vec2(groundHash(cell + 3.1), groundHash(cell + 7.7)) - 0.5;
    float dot_ = 1.0 - smoothstep(0.045, 0.075, length(local - jitter * 0.6));
    float patch_ = smoothstep(0.52, 0.7, groundNoise(vGroundXZ * 0.09 + 11.0));
    vec3 petal = pick > 0.992 ? vec3(1.0, 0.86, 0.3) : vec3(0.98, 0.98, 0.94);
    diffuseColor.rgb = mix(diffuseColor.rgb, petal, dot_ * step(0.955, pick) * patch_ * near);
    // Darker tufts everywhere else.
    float tuft = 1.0 - smoothstep(0.1, 0.2, length(local - jitter * 0.5));
    diffuseColor.rgb *= 1.0 - tuft * step(pick, 0.3) * 0.12 * near;
  }
`;

interface GroundMaterialOptions {
  /** Draw order among the coplanar ground layers. Higher paints on top. */
  layer: number;
  /** Strength of the large soft color variation (0 disables). */
  mottle?: number;
  /** Sprinkles tiny daisies and darker tufts, for lawns. */
  meadow?: boolean;
  roughness?: number;
}

/**
 * Material for the ground and the flat layers painted on it (green, paths,
 * roads). Layers sit a few centimeters above the ground and do not write
 * depth, so they never z-fight with each other; draw order decides.
 */
export function createGroundMaterial({
  layer,
  mottle = 0,
  meadow = false,
  roughness = 1,
}: GroundMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0,
    depthWrite: layer === 0,
    polygonOffset: layer > 0,
    polygonOffsetFactor: -2 * layer,
    polygonOffsetUnits: -2 * layer,
  });
  if (mottle > 0) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXZ;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec2 vGroundXZ;\n${NOISE_GLSL}`)
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
          float mottle = groundNoise(vGroundXZ * 0.045) * 0.6 + groundNoise(vGroundXZ * 0.31) * 0.4;
          diffuseColor.rgb *= 1.0 + (mottle - 0.5) * ${mottle.toFixed(3)};
          ${meadow ? MEADOW_GLSL : ""}`,
        );
    };
    material.customProgramCacheKey = () => `berlin-ground-${mottle}-${meadow}`;
  }
  return material;
}

/** Maps GLB node names to materials and draw order. */
export function createPlaceMaterials() {
  const materials: Record<string, THREE.Material> = {
    ground: createGroundMaterial({ layer: 0, mottle: 0.1 }),
    layer_green: createGroundMaterial({ layer: 1, mottle: 0.3, meadow: true }),
    layer_water: createGroundMaterial({ layer: 2, roughness: 0.25 }),
    layer_path: createGroundMaterial({ layer: 3, mottle: 0.1 }),
    layer_curb: createGroundMaterial({ layer: 4 }),
    layer_road: createGroundMaterial({ layer: 5, mottle: 0.08 }),
    layer_marking: createGroundMaterial({ layer: 6 }),
    buildings: createBuildingMaterial(),
  };
  const renderOrder: Record<string, number> = {
    ground: -8,
    layer_green: -7,
    layer_water: -6,
    layer_path: -5,
    layer_curb: -4,
    layer_road: -3,
    layer_marking: -2,
  };
  return { materials, renderOrder };
}
