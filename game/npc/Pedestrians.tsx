"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { CLOTHING_COLORS, HAIR_COLORS, SKIN_TONES } from "@/game/avatar/schema";
import { seededRandom } from "@/lib/random";

interface Walker {
  /** Cumulative distance of each waypoint along the route. */
  route: [number, number][];
  marks: number[];
  length: number;
  distance: number;
  direction: 1 | -1;
  speed: number;
  phase: number;
  size: number;
}

const matrix = new THREE.Matrix4();
const local = new THREE.Matrix4();
const base = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();
const euler = new THREE.Euler();
const color = new THREE.Color();

interface PedestriansProps {
  walkways: [number, number][][];
  count: number;
  heightAt: (x: number, z: number) => number;
  seed: number;
}

/**
 * Background passers-by without dialogue. They stroll back and forth along
 * footpaths taken from the map data. Five instanced meshes draw the whole
 * crowd, so a dozen walkers cost five draw calls.
 */
export function Pedestrians({ walkways, count, heightAt, seed }: PedestriansProps) {
  const torso = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const hair = useRef<THREE.InstancedMesh>(null);
  const legLeft = useRef<THREE.InstancedMesh>(null);
  const legRight = useRef<THREE.InstancedMesh>(null);

  const { walkers, looks } = useMemo(() => {
    const random = seededRandom(seed);
    const routes = walkways.filter((route) => route.length >= 2);
    const walkers: Walker[] = [];
    const looks: { top: string; legs: string; skin: string; hair: string }[] = [];
    for (let index = 0; index < count && routes.length > 0; index++) {
      const route = routes[index % routes.length];
      const marks = [0];
      for (let i = 1; i < route.length; i++) {
        marks.push(
          marks[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]),
        );
      }
      const length = marks[marks.length - 1];
      walkers.push({
        route,
        marks,
        length,
        distance: random() * length,
        direction: random() > 0.5 ? 1 : -1,
        speed: 1.05 + random() * 0.5,
        phase: random() * 6,
        size: 0.9 + random() * 0.15,
      });
      looks.push({
        top: CLOTHING_COLORS[Math.floor(random() * CLOTHING_COLORS.length)],
        legs: CLOTHING_COLORS[Math.floor(random() * CLOTHING_COLORS.length)],
        skin: SKIN_TONES[Math.floor(random() * SKIN_TONES.length)],
        hair: HAIR_COLORS[Math.floor(random() * 7)],
      });
    }
    return { walkers, looks };
  }, [walkways, count, seed]);

  const assets = useMemo(
    () => ({
      torso: new THREE.CapsuleGeometry(0.17, 0.3, 3, 8).translate(0, 1.08, 0),
      head: new THREE.SphereGeometry(0.2, 10, 8).translate(0, 1.56, 0),
      hair: new THREE.SphereGeometry(0.215, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)
        .rotateX(-0.3)
        .translate(0, 1.57, 0),
      // Legs hang from the hip so rotating them swings the foot.
      leg: new THREE.CapsuleGeometry(0.07, 0.6, 3, 6).translate(0, -0.37, 0),
      material: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    }),
    [],
  );

  useLayoutEffect(() => {
    looks.forEach((look, index) => {
      torso.current?.setColorAt(index, color.set(look.top));
      head.current?.setColorAt(index, color.set(look.skin));
      hair.current?.setColorAt(index, color.set(look.hair));
      legLeft.current?.setColorAt(index, color.set(look.legs));
      legRight.current?.setColorAt(index, color.set(look.legs));
    });
    for (const mesh of [torso, head, hair, legLeft, legRight]) {
      if (mesh.current?.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    }
  }, [looks]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    walkers.forEach((walker, index) => {
      walker.distance += walker.speed * walker.direction * delta;
      if (walker.distance > walker.length) {
        walker.distance = walker.length;
        walker.direction = -1;
      } else if (walker.distance < 0) {
        walker.distance = 0;
        walker.direction = 1;
      }
      walker.phase += delta * walker.speed * 5.2;

      // Locate the current segment.
      let segment = 1;
      while (segment < walker.marks.length - 1 && walker.marks[segment] < walker.distance)
        segment++;
      const [ax, az] = walker.route[segment - 1];
      const [bx, bz] = walker.route[segment];
      const span = walker.marks[segment] - walker.marks[segment - 1] || 1;
      const t = (walker.distance - walker.marks[segment - 1]) / span;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const heading = Math.atan2((bx - ax) * walker.direction, (bz - az) * walker.direction);

      position.set(x, heightAt(x, z) + Math.abs(Math.cos(walker.phase)) * 0.03, z);
      quaternion.setFromEuler(euler.set(0, heading, 0));
      base.compose(position, quaternion, scale.setScalar(walker.size));
      torso.current?.setMatrixAt(index, base);
      head.current?.setMatrixAt(index, base);
      hair.current?.setMatrixAt(index, base);

      const swing = Math.sin(walker.phase) * 0.55;
      for (const [mesh, side] of [
        [legLeft.current, 1],
        [legRight.current, -1],
      ] as const) {
        local.makeRotationX(-swing * side);
        local.setPosition(0.09 * side, 0.8, 0);
        mesh?.setMatrixAt(index, matrix.multiplyMatrices(base, local));
      }
    });
    for (const mesh of [torso, head, hair, legLeft, legRight]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (walkers.length === 0) return null;
  const common = { castShadow: true, frustumCulled: false } as const;
  return (
    <>
      <instancedMesh
        ref={torso}
        args={[assets.torso, assets.material, walkers.length]}
        {...common}
      />
      <instancedMesh ref={head} args={[assets.head, assets.material, walkers.length]} {...common} />
      <instancedMesh ref={hair} args={[assets.hair, assets.material, walkers.length]} {...common} />
      <instancedMesh
        ref={legLeft}
        args={[assets.leg, assets.material, walkers.length]}
        {...common}
      />
      <instancedMesh
        ref={legRight}
        args={[assets.leg, assets.material, walkers.length]}
        {...common}
      />
    </>
  );
}
