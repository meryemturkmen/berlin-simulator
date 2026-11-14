import * as THREE from "three";
import { daylight } from "@/game/sky/daylight";

const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  // Three octaves: broad stains down to fine grain.
  float fbm(vec2 p) {
    return valueNoise(p) * 0.55 + valueNoise(p * 2.7 + 13.1) * 0.3 + valueNoise(p * 7.3 + 41.7) * 0.15;
  }
`;

/**
 * Building material. Geometry carries no textures or normals; everything on
 * the facade is drawn in the fragment shader from the `_wall` attribute the
 * asset pipeline stores per vertex:
 *   x = meters along the wall, y = height above ground,
 *   z = wall width (0 on roofs and plain walls), w = height of the wall's top edge (0 on roofs).
 *
 * Facades get plaster with stains, a stone plinth, shop-height ground floors,
 * cornices, and windows with frames, mullions, sills, reveal shadows,
 * curtains and sky reflections. Roofs get tile courses. At night a random
 * subset of windows is lit.
 */
export function createBuildingMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.9,
    metalness: 0,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = daylight.uniforms.uNight;
    shader.uniforms.uSkyTop = { value: daylight.top };
    shader.uniforms.uSkyHorizon = { value: daylight.horizon };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 _wall;\nvarying vec4 vWall;\nvarying vec3 vWorld;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvWall = _wall;\nvWorld = (modelMatrix * vec4(position, 1.0)).xyz;",
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        uniform float uNight;
        uniform vec3 uSkyTop;
        uniform vec3 uSkyHorizon;
        varying vec4 vWall;
        varying vec3 vWorld;
        ${NOISE_GLSL}
        float band(float value, float from, float to) {
          return step(from, value) * step(value, to);
        }`,
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        float glassMask = 0.0;
        float litWindow = 0.0;
        vec3 litColor = vec3(0.0);
        {
          float wallWidth = vWall.z;
          float wallTop = vWall.w;
          float h = vWall.y;
          vec3 base = diffuseColor.rgb;
          // Coordinates that follow the surface: along the wall and up.
          vec2 surface = wallTop > 0.0 ? vec2(vWall.x + vWorld.x * 0.37 + vWorld.z * 0.61, h) : vWorld.xz;

          if (wallTop <= 0.0) {
            // Roof: tile courses on pitched roofs, gravel grain on flat ones.
            float course = fract(h * 3.4);
            base *= 0.9 + 0.1 * smoothstep(0.0, 0.25, course);
            base *= 0.86 + 0.26 * fbm(vWorld.xz * 0.9);
          } else {
            // Plaster: broad stains, fine grain, rain streaks from the top.
            base *= 0.9 + 0.16 * fbm(surface * vec2(0.35, 0.22));
            base *= 0.96 + 0.08 * valueNoise(surface * 9.0);
            base *= 1.0 - 0.07 * smoothstep(wallTop - 3.0, wallTop, h) * valueNoise(vec2(surface.x * 2.2, 0.0));
            // Grime where the wall meets the pavement.
            base *= mix(0.78, 1.0, smoothstep(0.0, 2.2, h));

            if (wallWidth > 2.2) {
              const float GROUND_FLOOR = 4.0;
              const float FLOOR = 3.3;
              float columns = max(1.0, floor(wallWidth / 2.8));
              float cellU = vWall.x / (wallWidth / columns);
              float column = floor(cellU);
              float fu = fract(cellU);
              float floors = floor((wallTop - GROUND_FLOOR - 0.6) / FLOOR);
              float style = hash21(vec2(floor(wallWidth * 3.0), floor(wallTop * 2.0)));
              vec3 trim = mix(base, vec3(0.86, 0.84, 0.8), 0.55);

              // Eaves cornice.
              base = mix(base, trim, band(h, wallTop - 0.45, wallTop - 0.1));
              base *= 1.0 - 0.25 * band(h, wallTop - 0.52, wallTop - 0.45);

              float inGlass = 0.0;
              float row = -1.0;
              float shade = 1.0;
              if (h < GROUND_FLOOR) {
                // Stone plinth, then shop-height openings under a fascia and cornice.
                vec3 stone = mix(base, vec3(0.42, 0.41, 0.4), 0.6);
                base = mix(base, stone, step(h, 0.75));
                base = mix(base, base * 0.9, band(h, 3.25, 3.8));
                base = mix(base, trim, band(h, 3.82, 4.0));
                float open = band(fu, 0.1, 0.9) * band(h, 0.75, 3.2);
                float pane = band(fu, 0.13, 0.87) * band(h, 0.85, 3.12);
                base = mix(base, vec3(0.13, 0.13, 0.14), open - pane);
                inGlass = pane;
                shade = 1.0 - 0.5 * smoothstep(2.7, 3.12, h);
              } else {
                float cellV = (h - GROUND_FLOOR) / FLOOR;
                row = floor(cellV);
                float fv = fract(cellV);
                // Stucco band between floors on older-looking facades.
                base = mix(base, trim, step(0.55, style) * step(fv, 0.045) * step(row, floors - 0.5));
                if (row < floors) {
                  float opening = band(fu, 0.25, 0.75) * band(fv, 0.2, 0.78);
                  float pane = band(fu, 0.275, 0.725) * band(fv, 0.225, 0.755);
                  // Thin glazing bars vanish at a distance instead of turning into noise.
                  float fine = 1.0 - smoothstep(0.004, 0.012, max(fwidth(fu), fwidth(fv)));
                  float mullion = (band(fu, 0.492, 0.508) + band(fv, 0.585, 0.6)) * fine;
                  float sill = band(fu, 0.22, 0.78) * band(fv, 0.165, 0.2);
                  // Streak of dirt below each sill.
                  base *= 1.0 - 0.08 * band(fu, 0.25, 0.75) * smoothstep(0.165, 0.0, fv) * step(fv, 0.165);
                  base = mix(base, trim * 1.03, sill);
                  base = mix(base, vec3(0.9, 0.89, 0.86), opening - pane);
                  inGlass = pane * (1.0 - clamp(mullion, 0.0, 1.0));
                  base = mix(base, vec3(0.9, 0.89, 0.86), pane * clamp(mullion, 0.0, 1.0));
                  // The pane sits back in the wall: the top and one side lie in shadow.
                  shade = 1.0 - 0.55 * smoothstep(0.66, 0.755, fv) - 0.25 * smoothstep(0.34, 0.275, fu);
                }
              }

              if (inGlass > 0.5) {
                float seed = hash21(vec2(column + floor(wallWidth * 7.0), row + floor(wallTop * 3.0)));
                float seed2 = hash21(vec2(row * 3.1 + 7.0, column + floor(wallTop * 5.0)));
                // Reflection of the sky, stronger at grazing angles.
                vec3 faceNormal = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
                float facing = abs(dot(normalize(vViewPosition), faceNormal));
                float fresnel = 0.2 + 0.55 * pow(1.0 - facing, 3.0);
                // Glass mirrors a pale, hazy sky rather than pure blue.
                vec3 sky = mix(uSkyHorizon, uSkyTop, 0.2 + 0.25 * fract(seed * 7.0));
                sky = mix(sky, vec3(dot(sky, vec3(0.33))), 0.45) * 0.8;
                vec3 interior = vec3(0.1, 0.115, 0.13);
                // Curtains at the sides of some windows.
                float curtain = step(0.45, seed2) * (step(fu, 0.36) + step(0.64, fu)) * step(GROUND_FLOOR, h);
                interior = mix(interior, vec3(0.5, 0.48, 0.44), curtain * 0.5);
                base = mix(interior, sky, fresnel) * shade;
                glassMask = 1.0;

                // After dark roughly four in ten windows are lit, in slightly different tones.
                float lit = step(0.6, seed) * uNight;
                vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.86, 0.62), seed2);
                warm = mix(warm, vec3(0.55, 0.7, 1.0), step(0.93, seed2));
                litColor = warm * (0.65 + 0.35 * curtain) * (0.75 + 0.25 * shade);
                litWindow = lit;
              }
            } else {
              // Plain masonry (churches, towers, narrow wall strips): stone courses.
              float course = fract(h / 0.62);
              base *= 0.93 + 0.07 * smoothstep(0.0, 0.08, course);
            }
          }
          diffuseColor.rgb = base;
        }`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, glassMask);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `#include <emissivemap_fragment>
        totalEmissiveRadiance += litColor * litWindow * 1.6;`,
      );
  };
  material.customProgramCacheKey = () => "berlin-building-v2";
  return material;
}

type GroundPattern = "paving" | "asphalt" | "gravel" | "grass" | "water" | "plain";

const PATTERNS: Record<GroundPattern, string> = {
  plain: "",
  // Large granite slabs with joints, each slab a touch different.
  paving: /* glsl */ `
    vec2 slab = vGroundXZ * vec2(0.62, 1.05) + vec2(vGroundXZ.y * 0.04, 0.0);
    vec2 slabId = floor(slab);
    vec2 slabUv = fract(slab);
    float joint = 1.0 - smoothstep(0.0, 0.035, min(min(slabUv.x, 1.0 - slabUv.x), min(slabUv.y, 1.0 - slabUv.y)));
    color *= 0.93 + 0.12 * hash21(slabId);
    color *= 1.0 - 0.3 * joint * detail;
    color *= 0.9 + 0.2 * fbm(vGroundXZ * 0.12);
    color *= 0.97 + 0.06 * valueNoise(vGroundXZ * 31.0) * detail;
  `,
  asphalt: /* glsl */ `
    color *= 0.86 + 0.26 * fbm(vGroundXZ * 0.09);
    color *= 0.9 + 0.2 * valueNoise(vGroundXZ * 43.0) * detail;
    // Worn, lighter wheel tracks and darker patches.
    color *= 1.0 - 0.1 * smoothstep(0.62, 0.8, valueNoise(vGroundXZ * 0.35 + 5.0));
  `,
  gravel: /* glsl */ `
    color *= 0.88 + 0.22 * fbm(vGroundXZ * 0.3);
    color *= 0.9 + 0.2 * valueNoise(vGroundXZ * 27.0) * detail;
  `,
  // Uneven lawn: lighter and darker drifts, dry patches, fine blades up close.
  grass: /* glsl */ `
    float drift = fbm(vGroundXZ * 0.045);
    color *= 0.74 + 0.46 * drift;
    color = mix(color, color * vec3(1.18, 1.08, 0.72), smoothstep(0.55, 0.85, valueNoise(vGroundXZ * 0.11 + 31.0)) * 0.55);
    color *= 0.86 + 0.28 * valueNoise(vGroundXZ * vec2(9.0, 23.0)) * detail + 0.14 * (1.0 - detail);
    color *= 0.93 + 0.14 * valueNoise(vGroundXZ * 37.0) * detail;
    // A few daisies.
    vec2 cell = floor(vGroundXZ * 2.4);
    vec2 inCell = fract(vGroundXZ * 2.4) - 0.5;
    vec2 jitter = vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5;
    float flower = (1.0 - smoothstep(0.03, 0.055, length(inCell - jitter * 0.6))) * step(0.975, hash21(cell));
    color = mix(color, vec3(0.95, 0.95, 0.9), flower * smoothstep(0.5, 0.7, valueNoise(vGroundXZ * 0.08 + 11.0)) * detail);
  `,
  water: /* glsl */ `
    float ripple = valueNoise(vGroundXZ * 0.9 + vec2(uTime * 0.35, uTime * 0.2)) * 0.6
      + valueNoise(vGroundXZ * 2.3 - vec2(uTime * 0.5, 0.0)) * 0.4;
    vec3 deep = color * 0.45;
    color = mix(deep, uSkyHorizon * 0.9, 0.35 + 0.4 * ripple);
  `,
};

interface GroundMaterialOptions {
  /** Draw order among the coplanar ground layers. Higher paints on top. */
  layer: number;
  pattern: GroundPattern;
  roughness?: number;
}

/**
 * Material for the ground and the flat layers painted on it. Layers sit a few
 * centimeters above the ground and do not write depth, so they never z-fight
 * with each other; draw order decides. Surface detail (slab joints, asphalt
 * grain, grass) is procedural and fades out with distance so it never shimmers.
 */
export function createGroundMaterial({
  layer,
  pattern,
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
  if (pattern !== "plain") {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = daylight.uniforms.uTime;
      shader.uniforms.uSkyHorizon = { value: daylight.horizon };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXZ;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\nvarying vec2 vGroundXZ;\nuniform float uTime;\nuniform vec3 uSkyHorizon;\n${NOISE_GLSL}`,
        )
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
          {
            vec3 color = diffuseColor.rgb;
            // 1 near the camera, 0 where a pixel covers too much ground for fine detail.
            float footprint = max(fwidth(vGroundXZ.x), fwidth(vGroundXZ.y));
            float detail = 1.0 - smoothstep(0.03, 0.14, footprint);
            ${PATTERNS[pattern]}
            diffuseColor.rgb = color;
          }`,
        );
    };
    material.customProgramCacheKey = () => `berlin-ground-v2-${pattern}`;
  }
  return material;
}

/** Maps GLB node names to materials and draw order. */
export function createPlaceMaterials() {
  const materials: Record<string, THREE.Material> = {
    ground: createGroundMaterial({ layer: 0, pattern: "paving" }),
    layer_green: createGroundMaterial({ layer: 1, pattern: "grass" }),
    layer_water: createGroundMaterial({ layer: 2, pattern: "water", roughness: 0.15 }),
    layer_path: createGroundMaterial({ layer: 3, pattern: "gravel" }),
    layer_curb: createGroundMaterial({ layer: 4, pattern: "gravel" }),
    layer_road: createGroundMaterial({ layer: 5, pattern: "asphalt", roughness: 0.92 }),
    layer_marking: createGroundMaterial({ layer: 6, pattern: "plain" }),
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
