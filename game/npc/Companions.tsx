"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { npcState } from "@/game/store/npcs";

/** A small acoustic guitar, worn across the chest. */
export function Guitar() {
  return (
    <group position={[-0.04, -0.12, 0.2]} rotation={[0.1, 0, 0.5]}>
      <mesh scale={[1, 1, 0.42]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
        <meshStandardMaterial color="#c98f4e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.24, 18]} />
        <meshStandardMaterial color="#d9a35f" roughness={0.6} />
      </mesh>
      <mesh position={[0.13, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.22, 18]} />
        <meshStandardMaterial color="#d9a35f" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.125]}>
        <circleGeometry args={[0.055, 14]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
      <mesh position={[0.45, 0, 0.02]}>
        <boxGeometry args={[0.62, 0.05, 0.035]} />
        <meshStandardMaterial color="#5a3d2b" roughness={0.8} />
      </mesh>
      <mesh position={[0.8, 0, 0.02]}>
        <boxGeometry args={[0.12, 0.08, 0.035]} />
        <meshStandardMaterial color="#3a2a20" />
      </mesh>
    </group>
  );
}

/** A friendly low-poly dog that wags its tail and hops when petted. */
export function Dog({ ownerId }: { ownerId: string }) {
  const body = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const action = npcState(ownerId).action;
    const excited = action?.id === "pet_dog" && performance.now() < action.until;
    if (tail.current)
      tail.current.rotation.y = Math.sin(time * (excited ? 22 : 9)) * (excited ? 0.9 : 0.5);
    if (body.current) body.current.position.y = excited ? Math.abs(Math.sin(time * 9)) * 0.14 : 0;
    if (head.current) head.current.rotation.z = Math.sin(time * 1.3) * 0.12;
  });

  const fur = <meshStandardMaterial color="#c79a63" roughness={0.9} />;
  const dark = <meshStandardMaterial color="#6b4a2f" roughness={0.9} />;
  return (
    <group ref={body}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.26, 0.24, 0.56]} />
        {fur}
      </mesh>
      {[
        [0.09, 0.2],
        [-0.09, 0.2],
        [0.09, -0.2],
        [-0.09, -0.2],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.11, z]} castShadow>
          <boxGeometry args={[0.07, 0.22, 0.07]} />
          {fur}
        </mesh>
      ))}
      <group ref={head} position={[0, 0.52, 0.32]}>
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.2, 0.22]} />
          {fur}
        </mesh>
        <mesh position={[0, -0.04, 0.15]}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          {fur}
        </mesh>
        <mesh position={[0, -0.01, 0.215]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshStandardMaterial color="#231a16" />
        </mesh>
        {[0.1, -0.1].map((x) => (
          <mesh key={x} position={[x, 0.08, -0.03]} rotation={[0, 0, x > 0 ? -0.4 : 0.4]}>
            <boxGeometry args={[0.06, 0.14, 0.1]} />
            {dark}
          </mesh>
        ))}
        {[0.06, -0.06].map((x) => (
          <mesh key={x} position={[x, 0.03, 0.112]}>
            <sphereGeometry args={[0.018, 6, 6]} />
            <meshStandardMaterial color="#231a16" />
          </mesh>
        ))}
      </group>
      <mesh ref={tail} position={[0, 0.46, -0.28]} rotation={[-0.7, 0, 0]}>
        <boxGeometry args={[0.05, 0.05, 0.24]} />
        {dark}
      </mesh>
    </group>
  );
}
