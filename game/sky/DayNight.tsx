"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { runtime } from "@/game/runtime";
import { Clouds } from "./Clouds";
import { daylight, updateDaylight } from "./daylight";

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
  varying vec3 vDirection;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float up = max(direction.y, 0.0);
    vec3 color = mix(uHorizon, uTop, pow(up, 0.55));

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

  useFrame((state, delta) => {
    updateDaylight(Math.min(delta, 0.1));
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(daylight.horizon);

    if (hemisphere.current) {
      hemisphere.current.intensity = daylight.ambient;
      hemisphere.current.color.copy(daylight.fill);
      hemisphere.current.groundColor.copy(daylight.fill).multiplyScalar(0.72);
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
      {clouds && <Clouds />}
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
