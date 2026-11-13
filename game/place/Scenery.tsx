"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { daylight } from "@/game/sky/daylight";
import type { Palette, PlaceManifest } from "@/lib/places/schema";

type HeightAt = (x: number, z: number) => number;

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const euler = new THREE.Euler();
const color = new THREE.Color();

function part(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotationX = 0) {
  const clone = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  clone.rotateX(rotationX);
  clone.translate(x, y, z);
  return clone;
}

/** Low-poly trees: one instanced trunk mesh and one instanced crown mesh. */
export function Trees({
  trees,
  palette,
  heightAt,
  castShadow,
}: {
  trees: PlaceManifest["trees"];
  palette: Palette;
  heightAt: HeightAt;
  castShadow: boolean;
}) {
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);

  const { trunkGeometry, crownGeometry, trunkMaterial, crownMaterial } = useMemo(() => {
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.26, 3, 6).translate(0, 1.5, 0);
    // A crown is three overlapping faceted blobs.
    const blob = (radius: number, x: number, y: number, z: number) =>
      new THREE.IcosahedronGeometry(radius, 1).scale(1, 0.82, 1).translate(x, y, z);
    const crownGeometry = mergeGeometries([
      blob(2.1, 0, 4.4, 0),
      blob(1.5, 1.2, 3.7, 0.5),
      blob(1.4, -1.0, 3.9, -0.7),
    ])!;
    const crownMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 });
    // Gentle wind: sway each crown around its base, phase-shifted per tree.
    crownMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = daylight.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `#include <begin_vertex>
          #ifdef USE_INSTANCING
            float phase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
            float sway = sin(uTime * 1.1 + phase) * 0.035 + sin(uTime * 2.3 + phase * 1.7) * 0.015;
            transformed.x += sway * transformed.y;
            transformed.z += sway * 0.6 * transformed.y;
          #endif`,
        );
    };
    crownMaterial.customProgramCacheKey = () => "berlin-crown";
    return {
      trunkGeometry,
      crownGeometry,
      trunkMaterial: new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 1 }),
      crownMaterial,
    };
  }, [palette.trunk]);

  useLayoutEffect(() => {
    if (!trunks.current || !crowns.current) return;
    trees.forEach(([x, z, size, variant], index) => {
      position.set(x, heightAt(x, z) - 0.05, z);
      // Deterministic rotation and squash so no two neighbors look identical.
      euler.set(0, (x * 12.9898 + z * 78.233) % (Math.PI * 2), 0);
      quaternion.setFromEuler(euler);
      const stretch = 0.9 + ((variant * 37 + index * 17) % 10) / 40;
      scale.set(size, size * stretch, size);
      matrix.compose(position, quaternion, scale);
      trunks.current!.setMatrixAt(index, matrix);
      crowns.current!.setMatrixAt(index, matrix);
      color.set(palette.foliage[(variant + index) % palette.foliage.length]);
      color.offsetHSL(0, 0, (((index * 7) % 9) - 4) / 120);
      crowns.current!.setColorAt(index, color);
    });
    for (const mesh of [trunks.current, crowns.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
  }, [trees, palette, heightAt]);

  if (trees.length === 0) return null;
  return (
    <>
      <instancedMesh
        ref={trunks}
        args={[trunkGeometry, trunkMaterial, trees.length]}
        castShadow={castShadow}
      />
      <instancedMesh
        ref={crowns}
        args={[crownGeometry, crownMaterial, trees.length]}
        castShadow={castShadow}
        receiveShadow
      />
    </>
  );
}

export const BENCH_SEAT_HEIGHT = 0.46;

/** Classic park benches: wooden slats on a dark frame, instanced. */
export function Benches({
  benches,
  heightAt,
}: {
  benches: PlaceManifest["benches"];
  heightAt: HeightAt;
}) {
  const wood = useRef<THREE.InstancedMesh>(null);
  const frame = useRef<THREE.InstancedMesh>(null);

  const { woodGeometry, frameGeometry, woodMaterial, frameMaterial } = useMemo(() => {
    const slat = new THREE.BoxGeometry(1.7, 0.05, 0.13);
    const woodGeometry = mergeGeometries([
      part(slat, 0, BENCH_SEAT_HEIGHT, 0.18),
      part(slat, 0, BENCH_SEAT_HEIGHT, 0.02),
      part(slat, 0, BENCH_SEAT_HEIGHT, -0.14),
      part(slat, 0, 0.72, -0.27, Math.PI / 2 - 0.2),
      part(slat, 0, 0.9, -0.31, Math.PI / 2 - 0.2),
    ])!;
    const leg = new THREE.BoxGeometry(0.07, BENCH_SEAT_HEIGHT, 0.46);
    const back = new THREE.BoxGeometry(0.07, 0.55, 0.06);
    const frameGeometry = mergeGeometries([
      part(leg, 0.7, BENCH_SEAT_HEIGHT / 2, 0.02),
      part(leg, -0.7, BENCH_SEAT_HEIGHT / 2, 0.02),
      part(back, 0.7, 0.74, -0.3, -0.2),
      part(back, -0.7, 0.74, -0.3, -0.2),
    ])!;
    return {
      woodGeometry,
      frameGeometry,
      woodMaterial: new THREE.MeshStandardMaterial({ color: "#b98250", roughness: 0.9 }),
      frameMaterial: new THREE.MeshStandardMaterial({ color: "#5a5f66", roughness: 0.7 }),
    };
  }, []);

  useLayoutEffect(() => {
    if (!wood.current || !frame.current) return;
    benches.forEach(([x, z, heading], index) => {
      position.set(x, heightAt(x, z), z);
      quaternion.setFromEuler(euler.set(0, heading, 0));
      matrix.compose(position, quaternion, scale.set(1, 1, 1));
      wood.current!.setMatrixAt(index, matrix);
      frame.current!.setMatrixAt(index, matrix);
    });
    for (const mesh of [wood.current, frame.current]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [benches, heightAt]);

  if (benches.length === 0) return null;
  return (
    <>
      <instancedMesh
        ref={wood}
        args={[woodGeometry, woodMaterial, benches.length]}
        castShadow
        receiveShadow
      />
      <instancedMesh ref={frame} args={[frameGeometry, frameMaterial, benches.length]} castShadow />
    </>
  );
}

const LAMP_HEIGHT = 4.6;

/** Street lamps that switch on at dusk, with a soft pool of light on the ground. */
export function Lamps({ lamps, heightAt }: { lamps: PlaceManifest["lamps"]; heightAt: HeightAt }) {
  const poles = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const pools = useRef<THREE.InstancedMesh>(null);

  const assets = useMemo(() => {
    const poleGeometry = mergeGeometries([
      part(new THREE.CylinderGeometry(0.04, 0.07, LAMP_HEIGHT, 6), 0, LAMP_HEIGHT / 2, 0),
      part(new THREE.CylinderGeometry(0.22, 0.1, 0.12, 8), 0, LAMP_HEIGHT + 0.06, 0),
    ])!;
    const headGeometry = new THREE.SphereGeometry(0.2, 10, 8).translate(0, LAMP_HEIGHT - 0.12, 0);
    const poolGeometry = new THREE.CircleGeometry(5.5, 24)
      .rotateX(-Math.PI / 2)
      .translate(0, 0.07, 0);
    const poolMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uNight: daylight.uniforms.uNight },
      vertexShader: /* glsl */ `
        varying vec2 vLocal;
        void main() {
          vLocal = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        varying vec2 vLocal;
        void main() {
          float falloff = smoothstep(5.5, 0.0, length(vLocal));
          gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * falloff * falloff * 0.5 * uNight, 1.0);
        }`,
    });
    return {
      poleGeometry,
      headGeometry,
      poolGeometry,
      poleMaterial: new THREE.MeshStandardMaterial({ color: "#4a5a57", roughness: 0.6 }),
      headMaterial: new THREE.MeshStandardMaterial({
        color: "#f4efe2",
        emissive: "#ffcf87",
        emissiveIntensity: 0,
      }),
      poolMaterial,
    };
  }, []);

  useLayoutEffect(() => {
    lamps.forEach(([x, z], index) => {
      position.set(x, heightAt(x, z), z);
      matrix.compose(position, quaternion.identity(), scale.set(1, 1, 1));
      for (const mesh of [poles.current, heads.current, pools.current])
        mesh?.setMatrixAt(index, matrix);
    });
    for (const mesh of [poles.current, heads.current, pools.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [lamps, heightAt]);

  useFrame(() => {
    assets.headMaterial.emissiveIntensity = daylight.uniforms.uNight.value * 3;
    if (pools.current) pools.current.visible = daylight.uniforms.uNight.value > 0.01;
  });

  if (lamps.length === 0) return null;
  return (
    <>
      <instancedMesh
        ref={poles}
        args={[assets.poleGeometry, assets.poleMaterial, lamps.length]}
        castShadow
      />
      <instancedMesh ref={heads} args={[assets.headGeometry, assets.headMaterial, lamps.length]} />
      <instancedMesh
        ref={pools}
        args={[assets.poolGeometry, assets.poolMaterial, lamps.length]}
        renderOrder={-1}
      />
    </>
  );
}
