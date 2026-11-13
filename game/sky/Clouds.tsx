"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seededRandom } from "@/lib/random";
import { daylight } from "./daylight";

const COUNT = 16;
const SPREAD = 520;
const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const quaternion = new THREE.Quaternion();
const scale = new THREE.Vector3();

/** A handful of puffy low-poly clouds drifting slowly across the sky. */
export function Clouds() {
  const mesh = useRef<THREE.InstancedMesh>(null);

  const { geometry, material, clouds } = useMemo(() => {
    const puff = (radius: number, x: number, y: number, z: number) =>
      new THREE.IcosahedronGeometry(radius, 1).translate(x, y, z);
    const geometry = mergeGeometries([
      puff(9, 0, 0, 0),
      puff(7, 9, -1, 1),
      puff(6.5, -9, -1.5, -1),
      puff(5, 15, -2.5, 0),
      puff(6, 3, 3, 2),
    ])!.scale(1, 0.55, 0.8);
    const material = new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.92 });
    const random = seededRandom(7);
    const clouds = Array.from({ length: COUNT }, () => ({
      x: (random() - 0.5) * SPREAD * 2,
      y: 90 + random() * 70,
      z: (random() - 0.5) * SPREAD * 2,
      size: 1.2 + random() * 2.2,
      speed: 1.2 + random() * 1.6,
      turn: random() * Math.PI,
    }));
    return { geometry, material, clouds };
  }, []);

  useLayoutEffect(() => {
    mesh.current?.computeBoundingSphere();
  }, []);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    clouds.forEach((cloud, index) => {
      cloud.x += cloud.speed * delta;
      if (cloud.x > SPREAD) cloud.x = -SPREAD;
      position.set(cloud.x, cloud.y, cloud.z);
      quaternion.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, cloud.turn);
      matrix.compose(position, quaternion, scale.setScalar(cloud.size));
      mesh.current!.setMatrixAt(index, matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    // Clouds pick up the sky's mood: white by day, peach at sunset, slate at night.
    material.color
      .copy(daylight.horizon)
      .lerp(WHITE, 0.55 * (1 - daylight.uniforms.uNight.value) + 0.08);
  });

  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} />;
}

const WHITE = new THREE.Color("#ffffff");
