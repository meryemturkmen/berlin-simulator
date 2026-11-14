"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { daylight } from "@/game/sky/daylight";
import { seededRandom } from "@/lib/random";
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
    // Trunk with two main branches reaching into the crown.
    const limb = (radiusTop: number, radiusBottom: number, length: number) =>
      new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7).translate(0, length / 2, 0);
    const trunkGeometry = mergeGeometries([
      limb(0.15, 0.27, 3.4),
      limb(0.07, 0.14, 2.2).rotateZ(0.55).translate(0, 2.7, 0),
      limb(0.07, 0.13, 2.0).rotateZ(-0.5).rotateY(1.9).translate(0, 2.9, 0),
    ])!;

    // Crown: irregular clumps of foliage around the branches. Each clump keeps
    // its own smooth normals, which reads as separate masses of leaves.
    const random = seededRandom(11);
    const clump = (radius: number, x: number, y: number, z: number) => {
      // Welded, so normals are averaged across faces and the clump shades smoothly.
      const geometry = mergeVertices(
        new THREE.IcosahedronGeometry(radius, 2).deleteAttribute("uv").deleteAttribute("normal"),
      );
      const positions = geometry.getAttribute("position");
      const vertex = new THREE.Vector3();
      for (let index = 0; index < positions.count; index++) {
        vertex.fromBufferAttribute(positions, index);
        // Lumpy rather than spherical; hashing by direction keeps seams closed.
        const bump =
          Math.sin(vertex.x * 3.1 + x) *
          Math.sin(vertex.y * 2.7 + y) *
          Math.sin(vertex.z * 3.3 + z);
        vertex.multiplyScalar(1 + bump * 0.16);
        positions.setXYZ(index, vertex.x, vertex.y * 0.82, vertex.z);
      }
      geometry.computeVertexNormals();
      return geometry.translate(x, y, z);
    };
    const clumps = [clump(1.9, 0, 4.9, 0)];
    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * Math.PI * 2 + random() * 0.6;
      const reach = 1.25 + random() * 0.55;
      clumps.push(
        clump(
          1.15 + random() * 0.45,
          Math.cos(angle) * reach,
          3.7 + random() * 1.5,
          Math.sin(angle) * reach,
        ),
      );
    }
    const crownGeometry = mergeGeometries(clumps)!;

    const crownMaterial = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    crownMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = daylight.uniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uTime;\nvarying vec3 vLeaf;",
        )
        .replace(
          "#include <begin_vertex>",
          /* glsl */ `#include <begin_vertex>
          vLeaf = position;
          #ifdef USE_INSTANCING
            // Gentle wind: sway around the base, phase-shifted per tree.
            float phase = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
            float sway = sin(uTime * 1.1 + phase) * 0.03 + sin(uTime * 2.3 + phase * 1.7) * 0.012;
            transformed.x += sway * transformed.y;
            transformed.z += sway * 0.6 * transformed.y;
            vLeaf += instanceMatrix[3].xyz;
          #endif`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          /* glsl */ `#include <common>
          varying vec3 vLeaf;
          float leafHash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }
          float leafNoise(vec3 p) {
            vec3 i = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(leafHash(i), leafHash(i + vec3(1, 0, 0)), f.x), mix(leafHash(i + vec3(0, 1, 0)), leafHash(i + vec3(1, 1, 0)), f.x), f.y),
              mix(mix(leafHash(i + vec3(0, 0, 1)), leafHash(i + vec3(1, 0, 1)), f.x), mix(leafHash(i + vec3(0, 1, 1)), leafHash(i + vec3(1, 1, 1)), f.x), f.y),
              f.z
            );
          }`,
        )
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
          // Leaf texture: clusters of lighter and darker foliage, darker inside and below.
          float leaves = leafNoise(vLeaf * 1.9) * 0.55 + leafNoise(vLeaf * 6.0) * 0.45;
          diffuseColor.rgb *= 0.55 + 1.1 * leaves;
          diffuseColor.rgb *= mix(0.68, 1.12, smoothstep(2.6, 6.2, vLeaf.y - floor(vLeaf.y / 1000.0) * 1000.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.15, 1.1, 0.7), smoothstep(0.7, 0.95, leaves) * 0.5);`,
        );
    };
    crownMaterial.customProgramCacheKey = () => "berlin-crown-v2";

    const trunkMaterial = new THREE.MeshStandardMaterial({ color: palette.trunk, roughness: 1 });
    return { trunkGeometry, crownGeometry, trunkMaterial, crownMaterial };
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
