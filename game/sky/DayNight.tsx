"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { daylight, updateDaylight } from "./daylight";

const GROUND_BOUNCE = new THREE.Color("#b8a888");

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 clip = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0);
    // Pin the dome to the far plane so it never clips scenery.
    gl_Position = clip.xyww;
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uNight;
  uniform float uTime;
  uniform float uClouds;
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise2(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(vec3(i, 1.0));
    float b = hash(vec3(i + vec2(1.0, 0.0), 1.0));
    float c = hash(vec3(i + vec2(0.0, 1.0), 1.0));
    float d = hash(vec3(i + vec2(1.0, 1.0), 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float cloudNoise(vec2 p) {
    float sum = 0.0;
    float amplitude = 0.5;
    for (int octave = 0; octave < 5; octave++) {
      sum += noise2(p) * amplitude;
      p = p * 2.03 + 17.0;
      amplitude *= 0.5;
    }
    return sum;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float up = max(direction.y, 0.0);
    vec3 color = mix(uHorizon, uTop, pow(up, 0.5));
    // Haze: the sky pales toward the horizon.
    color = mix(color, mix(uHorizon, vec3(1.0), 0.25), pow(1.0 - up, 6.0) * 0.6);

    float towardSun = max(dot(direction, normalize(uSunDirection)), 0.0);
    // Wide warm haze around the sun, strongest near the horizon.
    color += uSunColor * pow(towardSun, 6.0) * 0.22 * (1.0 - up);
    // Sun disc with a soft halo.
    color += uSunColor * (smoothstep(0.9993, 0.9997, towardSun) * 1.2 + pow(towardSun, 180.0) * 0.5) * (1.0 - uNight);

    // Stars: sparse bright cells on a direction grid.
    vec3 grid = direction * 190.0;
    vec3 cell = floor(grid);
    float twinkle = hash(cell);
    float star = step(0.994, twinkle) * smoothstep(0.32, 0.05, length(fract(grid) - 0.5));
    color += vec3(star) * uNight * smoothstep(0.02, 0.25, direction.y) * (0.5 + twinkle * 0.5);

    // Soft drifting clouds on a plane high above, thinning out toward the horizon.
    if (uClouds > 0.5 && direction.y > 0.02) {
      vec2 plane = direction.xz / (direction.y + 0.18);
      float density = cloudNoise(plane * 1.1 + vec2(uTime * 0.006, uTime * 0.002));
      float cover = smoothstep(0.5, 0.74, density) * smoothstep(0.02, 0.22, direction.y);
      // Lit side toward the sun, gray-blue undersides, dim at night.
      vec3 lit = mix(vec3(1.0), uSunColor, 0.35) * (1.0 - uNight * 0.82);
      vec3 shaded = mix(uTop, vec3(0.75, 0.78, 0.85), 0.6) * (1.0 - uNight * 0.75);
      float thickness = smoothstep(0.55, 0.9, density);
      vec3 cloud = mix(lit, shaded, thickness * 0.55) + uSunColor * pow(towardSun, 8.0) * 0.25 * (1.0 - uNight);
      color = mix(color, cloud, cover * 0.9);
    }

    // Fade to the horizon color below the horizon line.
    color = mix(color, uHorizon, smoothstep(0.0, -0.25, direction.y));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

interface DayNightProps {
  startHour: number;
  /** Shadow map resolution; 0 disables shadows. */
  shadowMapSize: number;
  fogFar: number;
  clouds: boolean;
}

/**
 * Accelerated day-night cycle: gradient sky dome with sun and stars, one
 * shadow-casting sun/moon light that follows the player, hemisphere fill and
 * distance fog tinted like the horizon.
 */
export function DayNight({ startHour, shadowMapSize, fogFar, clouds }: DayNightProps) {
  const scene = useThree((state) => state.scene);
  const light = useRef<THREE.DirectionalLight>(null);
  const hemisphere = useRef<THREE.HemisphereLight>(null);
  const dome = useRef<THREE.Mesh>(null);

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERTEX,
        fragmentShader: SKY_FRAGMENT,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: daylight.top },
          uHorizon: { value: daylight.horizon },
          uSunColor: { value: daylight.sun },
          uSunDirection: { value: daylight.sunDirection },
          uNight: daylight.uniforms.uNight,
          uTime: daylight.uniforms.uTime,
          uClouds: { value: 1 },
        },
      }),
    [],
  );

  useEffect(() => {
    daylight.hour = startHour;
    updateDaylight(0);
    const fog = new THREE.Fog(daylight.horizon.getHex(), fogFar * 0.35, fogFar);
    scene.fog = fog;
    return () => {
      scene.fog = null;
      skyMaterial.dispose();
    };
  }, [scene, startHour, fogFar, skyMaterial]);

  useEffect(() => {
    skyMaterial.uniforms.uClouds.value = clouds ? 1 : 0;
  }, [clouds, skyMaterial]);

  useFrame((state, delta) => {
    updateDaylight(Math.min(delta, 0.1));
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(daylight.horizon);

    if (hemisphere.current) {
      hemisphere.current.intensity = daylight.ambient;
      hemisphere.current.color.copy(daylight.fill);
      // Light bounced off the ground is warmer and weaker than light from the sky.
      hemisphere.current.groundColor
        .copy(daylight.fill)
        .lerp(GROUND_BOUNCE, 0.5)
        .multiplyScalar(0.45);
    }
    if (light.current) {
      // The shadow frustum travels with the player so resolution stays high nearby.
      const player = runtime.player.position;
      light.current.position.copy(player).addScaledVector(daylight.lightDirection, 80);
      light.current.target.position.copy(player);
      light.current.target.updateMatrixWorld();
      light.current.color.copy(daylight.sun);
      light.current.intensity = daylight.sunIntensity;
    }
    dome.current?.position.copy(state.camera.position);
  });

  const shadows = shadowMapSize > 0;
  return (
    <>
      <mesh ref={dome} material={skyMaterial} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[50, 32, 16]} />
      </mesh>
      <hemisphereLight ref={hemisphere} />
      <directionalLight
        ref={light}
        castShadow={shadows}
        shadow-mapSize={[shadowMapSize || 512, shadowMapSize || 512]}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
        shadow-camera-near={1}
        shadow-camera-far={200}
        shadow-bias={-0.0005}
        shadow-normalBias={0.12}
      />
    </>
  );
}
